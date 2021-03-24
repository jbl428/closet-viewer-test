import { S3Client } from "@aws-sdk/client-s3";
import { Either, left, right } from "fp-ts/Either";
import { identity, pipe } from "fp-ts/function";
import { array, either, record, taskEither } from "fp-ts";
import { ReaderTaskEither } from "fp-ts/ReaderTaskEither";
import { tryCatchK } from "fp-ts/TaskEither";

import fetch from "node-fetch";
import { basename, join } from "path";
import { URL } from "url";
import { sequenceT } from "fp-ts/Apply";
import { from } from "rxjs";
import { concatMap, map, toArray } from "rxjs/operators";
import { toTaskEither } from "fp-ts-rxjs/lib/ObservableEither";
import { addSlash, S3Key, SRest } from "./types";
import { downloadBuffer, uploads3 } from "./util";
import { Facets } from "./Facets";

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

function getZrestURLs(domain: string, token: string, styleIds: string[]) {
  return pipe(
    styleIds,
    array.map((styleId) =>
      pipe(
        fetchZrestURL_styleid(domain, token)(styleId),
        taskEither.chainEitherK(parseURL)
      )
    ),
    taskEither.sequenceArray
  );
}

/**
 * Facet<Buffer> to Facet<S3Key>
 * @param s3
 * @param bucket
 * @param baseKey
 */
export function writeAnswer(s3: S3Client, bucket: string, baseKey: string) {
  return (answersForFacets: Facets<Buffer[]>) =>
    pipe(
      answersForFacets,
      record.mapWithIndex((facetName, buffers) => {
        return pipe(
          buffers,
          array.mapWithIndex((idx, buffer) => {
            const key = join(baseKey, `answers`, facetName, `${idx}.png`);
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
}

export function writeZrestTestData(
  s3: S3Client,
  bucket: string,
  versionID: string
) {
  return (style: {
    zrest: Buffer;
    styleID: string;
    answersForFacets: Facets<Buffer[]>;
  }) => {
    const { styleID, zrest, answersForFacets } = style;
    const answerUpload = writeAnswer(
      s3,
      bucket,
      join(versionID, styleID)
    )(answersForFacets);
    const zrestKey = join(versionID, styleID, `viewer.zrest`);
    const zrestUpload = pipe(
      uploads3(s3, zrestKey, bucket)({ _tag: "buffer", buffer: zrest }),
      taskEither.map(() => zrestKey)
    );
    return pipe(
      sequenceT(taskEither.taskEither)(zrestUpload, answerUpload),
      taskEither.map(([zrestKey, answerKeys]) => ({
        styleID,
        zrestKey,
        answerKeys,
      }))
    );
  };
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
export function writeSRest(s3: S3Client, dirKey: string, bucket: string) {
  return (srestData: SRest<URL[]>) =>
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
