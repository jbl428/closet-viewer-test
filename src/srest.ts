import {
  decodeSRestTestDataSetInput,
  mapSrest,
  sequenceSrest,
  SRestPart,
} from "./types/Srest";
import { S3Client } from "@aws-sdk/client-s3";
import { URL } from "url";
import { pipe } from "fp-ts/function";
import { record, taskEither } from "fp-ts";
import { key2URL, srestS3KeyToURLStr } from "./util";
import { generateAnswerData, testCommon } from "./functions";
import { templateSrest } from "./template";
import * as fs from "fs";
import { fst, snd } from "fp-ts/Tuple";

export function regenerateAnswerData(
  jsonPath: string,
  outJsonPath: string,
  s3: S3Client,
  bucket: string,
  baseS3Key: string,
  libURL: URL
) {
  const dataSet = decodeSRestTestDataSetInput(
    JSON.parse(fs.readFileSync(jsonPath, "utf-8"))
  );
  return pipe(
    dataSet,
    taskEither.fromEither,
    taskEither.chain((dataSet) => {
      return pipe(
        dataSet,
        record.map((srestPart: SRestPart) => {
          return pipe(
            srestPart.srest,
            mapSrest((xx) => key2URL(xx.str, bucket, s3)),
            sequenceSrest(taskEither.ApplicativeSeq),
            taskEither.map((srestStr) => templateSrest(libURL)([srestStr]))
          );
        }),
        record.sequence(taskEither.ApplicativeSeq),
        taskEither.map(record.toArray),
        taskEither.chain(generateAnswerData(s3, bucket, baseS3Key, outJsonPath))
      );
    })
  );
}

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
    decodeSRestTestDataSetInput,
    taskEither.fromEither,
    // taskEither.mapLeft(x=>x as any),
    taskEither.chain((dataSet) => {
      return pipe(
        dataSet,
        record.map((x) => x.srest),
        record.map(srestS3KeyToURLStr({ Bucket, s3 })),
        record.sequence(taskEither.ApplicativeSeq)
      );
    }),
    taskEither.chain((xxx) => {
      const arr = pipe(xxx, record.toArray);
      const styleIDs = arr.map(fst);
      const srests = arr.map(snd);
      const jsx = templateSrest(libURL)(srests);
      return testCommon(
        answerJsonPath,
        jsx,
        styleIDs
      )({ bucket: Bucket, s3, debugImagePath: debugImageDir });
    })
  );
}
