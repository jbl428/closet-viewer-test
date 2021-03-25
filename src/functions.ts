import puppeteer, { Browser } from "puppeteer";

import {
  createNewPage,
  createTmpHTMLURL_JSX,
  streamPageEvents,
} from "page-request-emitter";
import * as E from "fp-ts/Either";
import { Either, isLeft } from "fp-ts/Either";
import * as D from "io-ts/Decoder";

import { concatMap, map, reduce, share } from "rxjs/operators";
import { pipe } from "fp-ts/function";
import { from, Observable, zip } from "rxjs";
import { bracket, tryCatchK } from "fp-ts/TaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import { ReaderTaskEither } from "fp-ts/ReaderTaskEither";

import { observableEither } from "fp-ts-rxjs";
import fs from "fs";
import { resolve } from "path";
import { hookDomain } from "./template";
import { spawnSync } from "child_process";
import {
  fromTaskEither,
  ObservableEither,
  toTaskEither,
} from "fp-ts-rxjs/lib/ObservableEither";
import { ReaderObservableEither } from "fp-ts-rxjs/lib/ReaderObservableEither";
import {
  array,
  either,
  reader,
  readonlyNonEmptyArray,
  record,
  taskEither,
} from "fp-ts";
import { none } from "fp-ts/Option";
import { semigroupAll } from "fp-ts/Semigroup";
import { AnswerData, tup } from "./types";
import { S3Client } from "@aws-sdk/client-s3";
import { teSequenceArrayConcat } from "./extension";
import { sequenceT } from "fp-ts/Apply";
import { downloadBufferFromS3 } from "./util";
import { applyFacets, facetFromArray, Facets } from "./Facets";
import { monoidSum } from "fp-ts/Monoid";

const base64ToBuffer = (encoding: string) => Buffer.from(encoding, "base64");
const cutDataURLHead = (dataURL: string) => {
  const header = "data:image/png;base64,";
  return dataURL.substring(header.length);
};

const principleViewResponse = D.type({
  images: D.array(D.string),
});

export function stopWhenError<_E, _A>(
  oe: ObservableEither<_E, _A>
): ObservableEither<_E, _A> {
  return new Observable<Either<_E, _A>>((subscriber) => {
    oe.subscribe({
      next(either) {
        if (!subscriber.closed) {
          subscriber.next(either);
          if (isLeft(either)) {
            subscriber.complete();
          }
        }
      },
      complete() {
        subscriber.complete();
      },
      error(err) {
        subscriber.error(err);
      },
    });
  });
}

export function streamScreenshots_browser(
  jsx: JSX.Element,
  hookDomain: string
): ReaderObservableEither<Browser, unknown, Facets<Buffer>> {
  const pageurl = createTmpHTMLURL_JSX(jsx);
  return pipe(
    createNewPage(),
    reader.map(fromTaskEither),
    reader.map((ob) => {
      return pipe(
        ob,
        observableEither.chain((page) => {
          const events = streamPageEvents(
            page,
            pageurl
          )({
            filter: (r) => r.url().startsWith(hookDomain),
            alterResponse: () => none,
            debugResponse: () => {},
          });
          return stopWhenError(events);
        }),
        observableEither.mapLeft((x) => x as unknown),
        observableEither.chain((xxx) => {
          switch (xxx._tag) {
            case "RequestIntercept":
              const principleViewBuffers = pipe(
                xxx.request.postData(),
                D.string.decode,
                E.map(JSON.parse),
                E.chain(principleViewResponse.decode),
                E.map((x) =>
                  facetFromArray(
                    x.images.map(cutDataURLHead).map(base64ToBuffer)
                  )
                ),
                E.mapLeft((x) => x as unknown)
                // E.sequence(A.array)
              );
              return from([principleViewBuffers]);
            case "Log":
              console.log("Log from page", xxx.message);
              return from([]);
          }
        })
      );
    })
  );
}

export function runWithBrowser<_E, _T>(
  browserReadingTask: ReaderTaskEither<Browser, _E, _T>
) {
  return bracket(
    tryCatchK(
      puppeteer.launch.bind(puppeteer),
      console.error
    )({ args: ["--no-sandbox", "--disable-web-security"] }),
    RTE.mapLeft((x) => x as any)(browserReadingTask),
    (browser) => {
      console.log("Releasing browser ...");
      return tryCatchK(() => browser.close(), console.error)();
    }
  );
}

function decodePossibleBuffer(x: unknown): string {
  return pipe(
    x,
    D.string.decode,
    either.getOrElse((_) => {
      if (x instanceof Buffer) {
        return x.toString("utf8");
      } else {
        console.log(x);
        return "Failed to decode: neither string or Buffer";
      }
    })
  );
}

function saveDebugImages(
  x: Buffer,
  y: Buffer,
  id: string,
  destination: string
) {
  const lexi = id;
  const xpath = resolve(destination, lexi + "-x.png");
  const ypath = resolve(destination, lexi + "-y.png");
  fs.writeFileSync(xpath, x);
  fs.writeFileSync(ypath, y);
  const spawned = spawnSync("closet-viewer-cv", [
    "-x",
    xpath,
    "-y",
    ypath,
    "--diff",
    resolve(destination, lexi + "-diff.png"),
    "--highlight",
    resolve(destination, lexi + "-highlight.png"),
    "--combined",
    resolve(destination, lexi + "-combined.png"),
  ]);

  console.log({
    stdout: decodePossibleBuffer(spawned.stdout),
    stderr: decodePossibleBuffer(spawned.stderr),
  });
  if (spawned.signal) {
    return E.left("closet-viewer-cv killed due to signal:" + spawned.signal);
  } else if (spawned.status) {
    return E.left(`closet-viewer-cv exited with error: ${spawned.status}`);
  } else {
    return E.right(1);
  }
}

function isDifferent([a, b]: [Buffer, Buffer]): boolean {
  return a.compare(b) !== 0;
}

export function testDataSet<D>(
  dataSet: { styleID: string; data: D; answer: AnswerData }[],
  Bucket: string,
  s3: S3Client,
  debugImageDir: string,
  jsx: JSX.Element
) {
  const answerStream = makeAnswerStream2(
    dataSet.map((x) => tup(x.styleID, x.answer)),
    Bucket,
    s3
  );

  if (!fs.existsSync(debugImageDir)) {
    fs.mkdirSync(debugImageDir);
  }
  return runWithBrowser((browser) => {
    const screenshots = streamScreenshots_browser(
      jsx,
      hookDomain
    )(browser).pipe(share());

    const compareResults = zip(screenshots, answerStream).pipe(
      map(([x, y]) => sequenceT(E.either)(x, y)),
      observableEither.map(([result, answer]) => {
        return sequenceT(applyFacets)(result, answer);
      }),
      observableEither.map(
        record.map(([input, answerSet]) => {
          return pipe(
            answerSet,
            readonlyNonEmptyArray.map((answer) => isDifferent([input, answer])),
            readonlyNonEmptyArray.fold(semigroupAll)
          );
        })
      )
    );

    const result = zip(
      dataSet.map((x) => x.styleID),
      compareResults,
      screenshots,
      answerStream
    ).pipe(
      map(([styleID, compareResult, screenshot, answers]) => {
        return pipe(
          sequenceT(either.either)(compareResult, screenshot, answers),
          either.map(([x, y, z]) => sequenceT(applyFacets)(x, y, z)),
          either.map(
            record.mapWithIndex(
              (
                facetKey,
                [isDifferent, screenshot, answers]
              ): Either<unknown, number> => {
                if (isDifferent) {
                  return saveDebugImages(
                    screenshot,
                    readonlyNonEmptyArray.head(answers),
                    styleID + "-" + facetKey,
                    debugImageDir
                  );
                } else {
                  return either.right(0);
                }
              }
            )
          ),
          either.chain(record.sequence(either.either)),
          either.map(record.foldMap(monoidSum)((x) => x))
        );
      }),
      reduce(either.getSemigroup(monoidSum).concat)
    );

    return toTaskEither(result);
  });
}

function makeAnswerStream2(
  testDataArr: readonly [string, AnswerData][],
  Bucket: string,
  s3: S3Client
) {
  return from(testDataArr).pipe(
    map((x) => x[1]),
    map(
      record.map(
        array.map((s3key) =>
          downloadBufferFromS3({ Bucket, Key: s3key.str }, s3)
        )
      )
    ),
    map(record.map(teSequenceArrayConcat)),
    map(
      record.map(
        taskEither.chainEitherK((buffers) => {
          return pipe(
            buffers,
            readonlyNonEmptyArray.fromReadonlyArray,
            either.fromOption(() => new Error("answers not exist") as unknown)
          );
        })
      )
    ),
    map(record.sequence(taskEither.taskEither)),
    concatMap((x) => x())
  );
}
