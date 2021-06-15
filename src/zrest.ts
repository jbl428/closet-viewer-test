import { decodeZRestTestDataSet, ZRestPart } from "./types/Zrest";
import { S3Client } from "@aws-sdk/client-s3";
import { URL } from "url";
import { pipe } from "fp-ts/function";
import { array, either, record, taskEither } from "fp-ts";
import { key2URL } from "./util";
import { generateAnswerData, testCommon } from "./functions";
import { templateZrest } from "./template";
import * as fs from "fs";

export function test(
  dataSetJsonPath: string,
  answerJsonPath: string,
  Bucket: string,
  s3: S3Client,
  libURL: URL,
  debugImageDir: string
) {
  return pipe(
    JSON.parse(fs.readFileSync(dataSetJsonPath, "utf-8")),
    decodeZRestTestDataSet,
    taskEither.fromEither,
    taskEither.chain((dataSet) => {
      const asArr = record.toArray(dataSet);
      const jsx = pipe(
        asArr.map((x) => x[1].key).map((x) => key2URL(x.str, Bucket, s3)),
        array.sequence(taskEither.ApplicativeSeq),
        taskEither.map((zrestURLs) => {
          return templateZrest(libURL)(zrestURLs.map((x) => new URL(x)));
        })
      );
      const sids = asArr.map((x) => x[0]);

      return pipe(
        jsx,
        taskEither.chain((jsx) => {
          return testCommon(
            answerJsonPath,
            jsx,
            sids
          )({
            bucket: Bucket,
            s3,
            debugImagePath: debugImageDir,
          });
        })
      );
    })
  );
}

export function regenerateAnswerData(
  jsonPath: string,
  outJsonPath: string,
  s3: S3Client,
  bucket: string,
  baseS3Key: string,
  libURL: URL
) {
  const dataSet = decodeZRestTestDataSet(
    JSON.parse(fs.readFileSync(jsonPath, "utf-8"))
  );
  return pipe(
    dataSet,
    either.map((dataSet) => {
      return pipe(
        dataSet,
        record.map((zrestPart: ZRestPart) => {
          return pipe(
            key2URL(zrestPart.key.str, bucket, s3),
            taskEither.map((urlStr) => templateZrest(libURL)([new URL(urlStr)]))
          );
        }),
        record.sequence(taskEither.ApplicativeSeq)
      );
    }),
    taskEither.fromEither,
    taskEither.flatten,
    taskEither.chain((asMap) => {
      const asTuples = record.toArray(asMap);
      return generateAnswerData(s3, bucket, baseS3Key, outJsonPath)(asTuples);
    })
  );
}
