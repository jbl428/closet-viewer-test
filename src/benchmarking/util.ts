import U, { pathToFileURL, URL } from "url";
import P from "path";
import os from "os";
import fs from "fs";
import { ReaderTaskEither } from "fp-ts/ReaderTaskEither";
import { pipe } from "fp-ts/function";
import {
  array,
  either,
  reader,
  readerEither,
  readerTaskEither,
  taskEither,
} from "fp-ts";
import { downloadBuffer } from "../util";
import { ReaderEither } from "fp-ts/ReaderEither";
import { v4 } from "uuid";
import { left, right } from "fp-ts/Either";
import { bracket, taskEitherSeq } from "fp-ts/TaskEither";
import * as D from "io-ts/Decoder";
import * as E from "fp-ts/Either";
import * as R from "fp-ts/Record";

export function withDownloadedZrests<_A>(
  zresturls: U.URL[],
  task: ReaderTaskEither<readonly U.URL[], Error, _A>
) {
  const zrestsDir = P.resolve(os.tmpdir(), `zrests-${v4()}`);
  fs.mkdirSync(zrestsDir, { recursive: true });
  console.log("tmp directory is made: " + zrestsDir);

  const downloadTask = pipe(
    zresturls.map((url) => cacheFile_downloadDir(url.toString())(zrestsDir)),
    array.sequence(taskEitherSeq)
  );
  const releaseTask = () => {
    console.log("removing temporary directory ", zrestsDir, " ...");
    return taskEither.of<Error, void>(
      fs.rmdirSync(zrestsDir, { recursive: true })
    );
  };
  return bracket(downloadTask, task, releaseTask);
}

function cacheFile_downloadDir(
  urlstr: string
): ReaderTaskEither<string, unknown, URL> {
  console.log("caching", urlstr);
  return pipe(
    genTmpPathForCache(urlstr),
    readerEither.map((newPath) => {
      console.log("caching location:", newPath);
      return pipe(
        downloadBuffer(urlstr),
        taskEither.map((buffer) => {
          fs.writeFileSync(newPath, buffer);
          return pathToFileURL(newPath);
        })
      );
    }),
    reader.map(either.sequence(taskEither.taskEither)),
    readerTaskEither.chainEitherK((xxx) => xxx)
  );
}

function genTmpPathForCache(
  urlstr: string
): ReaderEither<string, unknown, string> {
  return (downloadDir: string) => {
    try {
      const url = new URL(urlstr);
      const newDir = P.resolve(downloadDir, v4());
      fs.mkdirSync(newDir);
      const newFileName = P.basename(url.pathname);
      return right(P.resolve(newDir, newFileName));
    } catch (e) {
      if (e instanceof Error) return left(e);

      console.error(e);
      return left(new Error("Generating tmp path fail"));
    }
  };
}

export type DynamoN = { N: string };
export type DynamoS = { S: string };
export type DynamoM = { M: { [property: string]: DynamoAttribute } };
export type DynamoAttribute = DynamoM | DynamoN | DynamoS;

export function encodeDynamoFormat(
  raw: any
): E.Either<string, DynamoAttribute> {
  const tryNumber = D.number.decode(raw);
  if (E.isRight(tryNumber)) {
    return E.right({ N: tryNumber.right.toString() });
  }
  const tryString = D.string.decode(raw);
  if (E.isRight(tryString)) {
    return E.right({ S: tryString.right });
  }
  const tryMap = D.UnknownRecord.decode(raw);
  if (E.isRight(tryMap)) {
    return pipe(
      tryMap.right,
      R.map(encodeDynamoFormat),
      R.sequence(E.either),
      E.map((m) => ({ M: m }))
    );
  }
  return E.left(`unable to encode ${raw}`);
}
