import U from "url";
import got from "got";
import { Either, getApplyMonoid, left, right } from "fp-ts/Either";
import {
  decodeFpsResponse,
  Measurement,
  metricMaxMonoid,
  metricSumMonoid,
  Result,
} from "./types";
import { TaskEither, tryCatchK } from "fp-ts/TaskEither";
import { Browser, LaunchOptions, Page } from "puppeteer";
import {
  createNewIncognitoPage,
  createNewPage,
  createTmpHTMLURL_JSX,
  PPEvent,
  runWithBrowser,
  streamPageEvents,
} from "page-request-emitter";
import { none, Option, some } from "fp-ts/Option";
import { stopWhenError } from "../functions";
import { either, option, record, taskEither } from "fp-ts";
import { first, last, map, publish, reduce, share, take } from "rxjs/operators";
import { zip } from "rxjs";
import { observableEither } from "fp-ts-rxjs";
import {
  hookDomain,
  measureCue,
  templateForFPS,
  templateSrestBenchmarking,
  templateZrestBenchmarking,
} from "./template";
import { fromTaskEither, toTaskEither } from "fp-ts-rxjs/lib/ObservableEither";
import { compact } from "fp-ts-rxjs/lib/Observable";
import { sequenceT } from "fp-ts/Apply";
import { pipe } from "fp-ts/function";
import { SRest } from "../types";
import { withDownloadedZrests } from "./util";
import * as D from "io-ts/Decoder";

const _simpleGot = (urlStr: string) => got(urlStr);
const simpleGot = tryCatchK(_simpleGot, (x) => x);

export function benchmarkBundleSize(libURL: U.URL, benchmarkName: string) {
  return pipe(
    simpleGot(libURL.toString()),
    taskEither.map((rsp) => rsp.headers["content-length"]),
    taskEither.chainEitherK(
      (length): Either<unknown, Result> => {
        if (length === undefined) {
          return left(new Error("Unable to get content-length"));
        } else {
          return right({
            [benchmarkName]: {
              "Bundle Size": new Measurement(
                "mb",
                Number(length) / 1024 / 1024
              ),
            },
          });
        }
      }
    )
  );
}

export function logEvent(e: PPEvent) {
  switch (e._tag) {
    case "Log":
      console.log("PPEvent", "Log", e.message);
      break;
    case "RequestIntercept":
      console.log("PPEvent", "Request", e);
      break;
  }
  return e;
}

export function benchmarkPageMetric(
  liburl: U.URL,
  jsx: JSX.Element,
  benchmarkName: string,
  modelCount: number
) {
  console.log("liburl", liburl);
  const readMetricFromPage = (page: Page): TaskEither<unknown, Result> => {
    const events = streamPageEvents(
      page,
      createTmpHTMLURL_JSX(jsx)
    )({
      filter: (r) => r.url().startsWith(hookDomain),
      alterResponse: () => none,
      debugResponse() {},
    }).pipe(stopWhenError, map(either.map(logEvent)), share());

    const firstEventTime = toTaskEither(
      events.pipe(
        first(),
        observableEither.map(() => Date.now())
      )
    );
    const lastEventTime = toTaskEither(
      events.pipe(
        last(),
        observableEither.map(() => Date.now())
      )
    );
    const timeTask = pipe(
      sequenceT(taskEither.taskEither)(firstEventTime, lastEventTime),
      taskEither.map(([x, y]) => y - x)
    );

    const metrics = events.pipe(
      observableEither.map((event) => {
        switch (event._tag) {
          case "RequestIntercept":
            if (event.request.postData() === measureCue) {
              const p = tryCatchK(
                () => page.metrics(),
                (x) => x
              )();
              return some(p);
            }
        }
        return none;
      }),
      map(either.sequence(option.option)),
      compact,
      observableEither.chain(fromTaskEither)
    );

    const sumMon = getApplyMonoid(metricSumMonoid);
    const maxMon = getApplyMonoid(metricMaxMonoid);
    const measurementMapper = (key: string, val: number): Measurement => {
      switch (key) {
        case "JSHeapUsedSize":
          return new Measurement("bytes", val);
        case "JSHeapTotalSize":
          return new Measurement("bytes", val);
        case "TaskDuration":
          return new Measurement("s", val);
        default:
          return new Measurement("?", val);
      }
    };
    const metricPairOb = metrics.pipe(
      publish((multicasted) =>
        zip(
          // Average
          multicasted.pipe(reduce(sumMon.concat, sumMon.empty)),
          // Max
          multicasted.pipe(reduce(maxMon.concat, maxMon.empty))
        )
      ),
      map(([averageEither, maxEither]) => {
        return sequenceT(either.either)(averageEither, maxEither);
      })
    );
    const metricPairTask = toTaskEither(metricPairOb);

    return pipe(
      sequenceT(taskEither.taskEither)(metricPairTask, timeTask),
      taskEither.map(
        ([[average, max], time]): Result => {
          const averageKeyChanged = pipe(
            average,
            record.map((v) => v / modelCount),
            record.mapWithIndex(measurementMapper),
            record.reduceRightWithIndex(
              {} as Record<string, Measurement>,
              (k, v, b) => {
                b[k + "_Mean"] = v;
                return b;
              }
            )
          );
          const maxKeyChanged = pipe(
            max,
            record.mapWithIndex(measurementMapper),
            record.reduceRightWithIndex(
              {} as Record<string, Measurement>,
              (k, v, b) => {
                b[k + "_Max"] = v;
                return b;
              }
            )
          );
          return {
            [benchmarkName]: {
              ...averageKeyChanged,
              ...maxKeyChanged,
              Time: new Measurement("ms", time),
            },
          };
        }
      )
    );
  };
  const browserReader = (browser: Browser): TaskEither<Error, Result> => {
    return pipe(
      createNewIncognitoPage()(browser),
      taskEither.chain(readMetricFromPage),
      taskEither.mapLeft(
        (err): Error => {
          if (err instanceof Error) {
            return err;
          } else {
            console.error(err);
            return new Error("Metric Benchmarking failed");
          }
        }
      )
    );
  };
  return runWithBrowser(launchOption, browserReader);
}

const launchOption: LaunchOptions = {
  args: ["--no-sandbox", "--disable-web-security", "--use-gl=egl"],
};

export function benchmarkSrestLoadingWithSrests(
  liburl: U.URL,
  srests: readonly SRest<string>[],
  benchmarkingName: string
) {
  return benchmarkPageMetric(
    liburl,
    templateSrestBenchmarking(liburl, srests),
    benchmarkingName,
    srests.length
  );
}

export function benchmarkZrestLoading(
  libURL: U.URL,
  zrestURLs: U.URL[],
  benchmarkName: string
): TaskEither<unknown, Result> {
  console.log("Loading benchmarking start");
  return withDownloadedZrests(zrestURLs, (cachedzrests) => {
    return benchmarkPageMetric(
      libURL,
      templateZrestBenchmarking(libURL, cachedzrests),
      benchmarkName,
      zrestURLs.length
    );
  });
}

export function benchmarkFPS(
  libURL: U.URL,
  heavyZrestURL: U.URL,
  viewWidth: number,
  viewHeight: number,
  timeMS: number,
  benchmarkingName: string
) {
  const jsx = templateForFPS(
    libURL,
    heavyZrestURL,
    timeMS,
    viewWidth,
    viewHeight
  );
  const pageurl = createTmpHTMLURL_JSX(jsx);
  const pageReader = (page: Page) => {
    const eventStream = streamPageEvents(
      page,
      pageurl
    )({
      filter: (r) => r.url().startsWith(hookDomain),
      alterResponse: () => none,
      debugResponse: () => {},
    });
    return pipe(
      stopWhenError(eventStream),
      observableEither.map(
        (xxx): Option<string | undefined> => {
          switch (xxx._tag) {
            case "Log":
              console.log(xxx.message);
              return none;
            case "RequestIntercept":
              return some(xxx.request.postData());
          }
        }
      ),
      map(either.sequence(option.option)),
      compact,
      take(1),
      toTaskEither,
      taskEither.chainEitherKW(D.string.decode),
      taskEither.map(JSON.parse),
      taskEither.chainEitherKW(decodeFpsResponse),
      taskEither.map(
        (decoded): Result => ({
          [benchmarkingName]: {
            mean: new Measurement("fps", decoded.fps),
          },
        })
      )
    );
  };
  return runWithBrowser(launchOption, (browser: Browser) => {
    return pipe(
      createNewPage()(browser),
      taskEither.chain(pageReader),
      taskEither.mapLeft((err) => {
        if (err instanceof Error) {
          return err;
        } else {
          console.error(err);
          return new Error("Failed");
        }
      })
    );
  });
}
