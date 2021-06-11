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
  eq,
  reader,
  readonlyArray,
  record,
  semigroup,
  set,
  taskEither,
} from "fp-ts";
import { none } from "fp-ts/Option";
import { S3Key, tup, tup3 } from "./types/types";
import { S3Client } from "@aws-sdk/client-s3";
import { sequenceT } from "fp-ts/Apply";
import { downloadBufferFromS3 } from "./util";
import { applyFacets, facetFromArray, Facets } from "./Facets";
import { monoidSum } from "fp-ts/Monoid";
import {
  AnswerDataS3Key,
  AnswerDataSet,
  AnswerDataT,
  decodeAnswerDataSet,
  mapAnswerData,
  mapAnswerDataGenericS3KeyToAnswerDataS3Key,
  sequenceAnswerData,
} from "./types/AnswerData";
import { writeOutputsToS3 } from "./write";

const base64ToBuffer = (encoding: string) => Buffer.from(encoding, "base64");
const cutDataURLHead = (dataURL: string) => {
  const header = "data:image/png;base64,";
  return dataURL.substring(header.length);
};

const principleViewResponse = D.type({
  captures: D.array(D.array(D.string)),
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
): ReaderObservableEither<Browser, unknown, Array<Facets<Buffer>>> {
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
                E.map((x) => {
                  return pipe(
                    x.captures,
                    array.map((capture) =>
                      facetFromArray(
                        capture.map(cutDataURLHead).map(base64ToBuffer)
                      )
                    )
                  );
                }),
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

function testDataSet(
  dataSet: { styleID: string; answer: AnswerDataS3Key }[],
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
        return array.zipWith(result, answer, sequenceT(applyFacets));
      }),
      observableEither.map(
        array.map(
          record.map(([input, answerSet]) => {
            return pipe(
              answerSet,
              readonlyArray.map((answer) => isDifferent([input, answer])),
              readonlyArray.reduceRight(true, (x, y) => x && y)
            );
          })
        )
      ),
      observableEither.mapLeft((x) => x as any)
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
          either.chain(
            ([resultFacetsSet, screenshotFacetsSet, answerFacetsSet]) => {
              const facetsTuple3s = pipe(
                array.zip(
                  resultFacetsSet,
                  array.zip(screenshotFacetsSet, answerFacetsSet)
                ),
                array.map(([x, [y, z]]) => tup3(x, y, z))
              );
              if (
                resultFacetsSet.length !== screenshotFacetsSet.length &&
                screenshotFacetsSet.length !== answerFacetsSet.length
              ) {
                return either.left(
                  new Error(
                    `${styleID}'s result, screenshot, answer's length are not all the same: ${resultFacetsSet.length} ${screenshotFacetsSet.length} ${answerFacetsSet.length}`
                  )
                );
              }
              return either.right(facetsTuple3s);
            }
          ),
          either.map(array.map(([x, y, z]) => sequenceT(applyFacets)(x, y, z))),
          either.map(
            array.mapWithIndex((idx, x) => {
              return pipe(
                x,
                record.mapWithIndex(
                  (
                    facetKey,
                    [isDifferent, screenshot, answers]
                  ): Either<unknown, number> => {
                    if (isDifferent) {
                      const saving = saveDebugImages(
                        screenshot,
                        answers[0],
                        styleID + "-" + idx.toString() + "-" + facetKey,
                        debugImageDir
                      );
                      return pipe(
                        saving,
                        either.map(() => 1)
                      );
                    } else {
                      return either.right(0);
                    }
                  }
                )
              );
            })
          ),
          either.map(array.map(record.sequence(either.either))),
          either.chain(either.sequenceArray),
          // either.map(xx=>xx),
          either.map(readonlyArray.map(record.foldMap(monoidSum)((x) => x))),
          either.map(readonlyArray.foldMap(monoidSum)((x) => x))
        );
      }),
      reduce(either.getSemigroup(monoidSum).concat)
    );

    return toTaskEither(result);
  });
}

function makeAnswerStream2(
  testDataArr: readonly [string, AnswerDataS3Key][],
  Bucket: string,
  s3: S3Client
): Observable<E.Either<unknown, AnswerDataT<Buffer>>> {
  return from(testDataArr).pipe(
    map((x) => x[1]),
    map(
      mapAnswerData((s3key) =>
        downloadBufferFromS3({ Bucket, Key: s3key.str }, s3)
      )
    ),
    map(sequenceAnswerData(taskEither.ApplicativeSeq)),
    concatMap(fromTaskEither)
  );
}
export function generateAnswerData(
  s3: S3Client,
  bucket: string,
  baseS3Key: string,
  outJsonPath: string
) {
  //
  return (idJSXtuples: Array<[string, JSX.Element]>) => {
    return pipe(
      writeOutputsToS3(s3, bucket, baseS3Key, idJSXtuples),
      taskEither.map((writeResults: [string, AnswerDataT<S3Key>][]) => {
        const answerDataSet: AnswerDataSet = pipe(
          writeResults,
          record.fromFoldable(
            semigroup.getLastSemigroup<AnswerDataT<S3Key>>(),
            array.Foldable
          ),
          record.map((x) => ({
            answers: mapAnswerDataGenericS3KeyToAnswerDataS3Key(x),
          }))
        );

        fs.writeFileSync(
          outJsonPath,
          JSON.stringify(answerDataSet, undefined, 2)
        );
      })
    );
  };
}

export function testCommon(
  answerJsonPath: string,
  jsx: JSX.Element,
  styleIDOrder: Array<string>
) {
  return pipe(
    JSON.parse(fs.readFileSync(answerJsonPath, "utf-8")),
    decodeAnswerDataSet,
    either.chain((answerDataSet) => {
      const sidSet = set.fromArray(eq.eqString)(styleIDOrder);
      const answerKeySet = set.fromArray(eq.eqString)(
        record.keys(answerDataSet)
      );
      if (!set.subset(eq.eqString)(sidSet)(answerKeySet)) {
        console.error("sid set");
        sidSet.forEach(console.error);
        console.error("answer key set");
        answerKeySet.forEach(console.error);
        return either.left(
          new Error("sid set is not subset of answer key set") as any
        );
      }

      const answerPairs = styleIDOrder.map((sid) =>
        tup(sid, answerDataSet[sid])
      );
      return either.right(answerPairs);
    }),
    either.map((answerPairs) => {
      const dataSet = answerPairs.map(([styleID, answer]) => ({
        styleID,
        answer: answer.answers,
      }));
      return ({
        bucket,
        s3,
        debugImagePath,
      }: {
        bucket: string;
        s3: S3Client;
        debugImagePath: string;
      }) => testDataSet(dataSet, bucket, s3, debugImagePath, jsx);
    }),
    either.sequence(reader.Applicative),
    reader.map(taskEither.fromEither),
    reader.map(taskEither.flatten)
  );
}
