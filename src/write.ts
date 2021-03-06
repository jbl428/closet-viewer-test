import { S3Client } from "@aws-sdk/client-s3";
import { Either, left, right } from "fp-ts/Either";
import { identity, pipe } from "fp-ts/function";
import { array, either, readonlyArray, record, taskEither } from "fp-ts";
import { ReaderTaskEither } from "fp-ts/ReaderTaskEither";
import { TaskEither, taskEitherSeq, tryCatchK } from "fp-ts/TaskEither";

import fetch from "node-fetch";
import { basename, join } from "path";
import { URL } from "url";
import { from } from "rxjs";
import { concatMap, first, map, toArray } from "rxjs/operators";
import { toTaskEither } from "fp-ts-rxjs/lib/ObservableEither";
import { addSlash, S3Key, tup } from "./types/types";
import { downloadBuffer, uploads3 } from "./util";
import { hookDomain } from "./template";
import { runWithBrowser, streamScreenshots_browser } from "./functions";
import { decodeSRestResponse, mapSrest, SRest, SRestPart } from "./types/Srest";
import { ZRestPart } from "./types/Zrest";
import { Browser } from "puppeteer";
import { AnswerDataT } from "./types/AnswerData";

function fetchZrestURL_styleid(
  domain: string,
  token: string
): ReaderTaskEither<string, unknown, string> {
  const aa = (styleId: string) => {
    return fetch(addSlash(domain) + `api/Item/ZrestUrl/${styleId}/`, {
      headers: {
        Authorization: "Bearer " + token,
        "api-version": "1.0",
      },
    }).then((x) => x.text());
  };
  return tryCatchK(aa, identity);
}

/**
 * Facet<Buffer> to Facet<S3Key>
 * @param s3
 * @param bucket
 * @param baseKey
 */
function writeAnswer(s3: S3Client, bucket: string, baseKey: string) {
  return (answersForFacets: AnswerDataT<Buffer>) =>
    pipe(
      answersForFacets,
      array.mapWithIndex((sequenceIdx, facets) => {
        return pipe(
          facets,
          record.mapWithIndex((facetName, buffers) => {
            return pipe(
              buffers,
              readonlyArray.mapWithIndex((alterAnswerIdx, buffer) => {
                const key = join(
                  baseKey,
                  `answers`,
                  sequenceIdx.toString(),
                  facetName,
                  `${alterAnswerIdx}.png`
                );
                return pipe(
                  uploads3(s3, key, bucket)({ _tag: "buffer", buffer }),
                  taskEither.map(() => new S3Key(key))
                );
              }),
              taskEither.sequenceArray
            );
          }),
          record.sequence(taskEither.taskEither)
        );
      }),
      array.sequence(taskEither.ApplicativeSeq)
    );
}

function parseURL(str: string): Either<unknown, URL> {
  try {
    const trimmed = /^"(.+)"$/.exec(str);
    if (trimmed === null) return left("trimming quotation mark failed: " + str);
    else return right(new URL(trimmed[1]));
  } catch (e) {
    return left(e);
  }
}

/**
 * SRest<URL> to SRest<S3Key>
 * @param s3
 * @param dirKey
 * @param bucket
 */
function writeSRest(s3: S3Client, dirKey: string, bucket: string) {
  return (srestData: SRest<URL>) =>
    pipe(
      srestData,
      record.mapWithIndex((partKey, urls) => {
        const obe = from(urls).pipe(
          concatMap((url) => {
            const key = new S3Key(
              join(dirKey, partKey, basename(url.pathname))
            );

            const tsk = pipe(
              downloadBuffer(url.toString()),
              taskEither.chain((buffer) =>
                uploads3(s3, key.str, bucket)({ _tag: "buffer", buffer })
              ),
              taskEither.map(() => key)
            );

            return tsk();
          }),
          toArray(),
          map(either.sequenceArray)
        );

        return toTaskEither(obe);
      }),
      record.sequence(taskEither.taskEither)
    );
}

export type Config = {
  domain: string;
  token: string;
  libURL: string;
  s3: S3Client;
  baseKey: string;
  bucket: string;
};

export function fetchSrest_styleid(
  domain: string,
  token: string
): ReaderTaskEither<string, any, SRest<string>> {
  return (styleId: string) => {
    return () =>
      fetch(addSlash(domain) + `api/styles/${styleId}/versions/1/zrest`, {
        headers: {
          Authorization: "Bearer " + token,
          "api-version": "2.0",
        },
      })
        .then((x) => x.text())
        .then((text) => {
          // console.log("body", text);
          return JSON.parse(text);
        })
        .then(decodeSRestResponse)
        .then(either.map((x) => x.result))
        .then(
          either.mapLeft((e) => {
            console.error(e);
            return new Error("SRestResponse decode fail");
          })
        )
        .catch((err) => {
          console.error(err);
          return either.left(err);
        });
  };
}

export function copySrestFromCLOSETToS3({
  domain,
  token,
  s3,
  baseKey,
  bucket,
}: Config) {
  return (styleID: string): TaskEither<unknown, SRestPart> =>
    pipe(
      fetchSrest_styleid(domain, token)(styleID),
      taskEither.chain((srestStr) => {
        const s3Key = join(baseKey, styleID);
        return pipe(
          srestStr,
          mapSrest((x) => new URL(x)),
          writeSRest(s3, s3Key, bucket),
          taskEither.map((srest) => ({
            srest: pipe(srest, record.map(readonlyArray.toArray)),
          }))
        );
      })
    );
}

export function copyZrestFromCLOSETToS3({
  domain,
  token,
  s3,
  baseKey,
  bucket,
}: Config) {
  return (styleID: string): TaskEither<unknown, ZRestPart> => {
    return pipe(
      fetchZrestURL_styleid(domain, token)(styleID),
      taskEither.chainEitherK(parseURL),
      taskEither.chain((zrestURL) => {
        const zrestKey = join(baseKey, styleID, `viewer.zrest`);

        return pipe(
          downloadBuffer(zrestURL.toString()),
          taskEither.chain((buffer) =>
            uploads3(s3, zrestKey, bucket)({ _tag: "buffer", buffer })
          ),
          taskEither.map(() => ({
            key: new S3Key(zrestKey),
          }))
        );
      })
    );
  };
}

export function writeOutputsToS3(
  s3: S3Client,
  bucket: string,
  baseS3Key: string,
  items: [string, JSX.Element][]
) {
  const browserReader = (browser: Browser) => {
    return pipe(
      items,
      array.map(([styleID, jsx]) => {
        const answerStream = streamScreenshots_browser(
          jsx,
          hookDomain
        )(browser);
        const answerForEachFacet = toTaskEither(answerStream.pipe(first()));
        return pipe(
          answerForEachFacet,
          taskEither.map(array.map(record.map((x) => [x]))),
          taskEither.chain(
            writeAnswer(s3, bucket, join(baseS3Key, styleID, "answers"))
          ),
          taskEither.map((answers) => tup(styleID, answers))
        );
      }),
      array.sequence(taskEitherSeq)
    );
  };
  return runWithBrowser(browserReader);
}
