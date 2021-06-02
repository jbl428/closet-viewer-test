import { decodeZRestTestDataSet, ZRestPart } from "./types/Zrest";
import { S3Client } from "@aws-sdk/client-s3";
import { URL } from "url";
import { pipe } from "fp-ts/function";
import { array, readonlyArray, record, taskEither } from "fp-ts";
import { key2URL } from "./util";
import { taskEitherSeq } from "fp-ts/TaskEither";
import { testDataSet } from "./functions";
import { templateZrest } from "./template";
import * as fs from "fs";
import { writeOutputsToS3 } from "./write";

export function test(
  dataSetJsonPath: string,
  Bucket: string,
  s3: S3Client,
  libURL: URL,
  debugImageDir: string
) {
  return pipe(
    JSON.parse(fs.readFileSync(dataSetJsonPath, "utf-8")),
    decodeZRestTestDataSet,
    taskEither.fromEither,
    taskEither.chain((zrestTestDataSet) => {
      const arr = pipe(zrestTestDataSet, record.toArray);

      const styleIDs = arr.map(([x]) => x);
      const answers = arr.map(([_, x]) => x.answers);
      const keys = arr.map(([_, x]) => x.key);

      const zrestURLs = pipe(
        keys.map((x) => key2URL(x.str, Bucket, s3)),
        array.sequence(taskEitherSeq)
      );

      return pipe(
        zrestURLs,
        taskEither.chain((urls) => {
          const aaa = urls.map((url, idx) => ({
            data: new URL(url),
            styleID: styleIDs[idx],
            answer: answers[idx],
          }));
          return testDataSet(
            aaa,
            Bucket,
            s3,
            debugImageDir,
            templateZrest(libURL)(urls.map((x) => new URL(x)))
          );
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
    taskEither.fromEither,
    taskEither.chain((dataSet) => {
      return pipe(
        dataSet,
        record.map((zrestPart: ZRestPart) => {
          return pipe(
            key2URL(zrestPart.key.str, bucket, s3),
            taskEither.map((urlStr) => templateZrest(libURL)([new URL(urlStr)]))
          );
        }),
        record.sequence(taskEither.ApplicativeSeq),
        taskEither.map(record.toArray),
        taskEither.chain((idJSXtuples) => {
          return writeOutputsToS3(s3, bucket, baseS3Key, idJSXtuples);
        }),
        taskEither.map((answers) => {
          for (const [styleID, answer] of answers) {
            dataSet[styleID].answers = pipe(
              answer,
              record.map(readonlyArray.toArray)
            );
          }

          fs.writeFileSync(outJsonPath, JSON.stringify(dataSet, undefined, 2));
        })
      );
    })
  );
}
