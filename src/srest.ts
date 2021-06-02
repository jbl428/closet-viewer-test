import {
  decodeSRestTestDataSet,
  mapSrest,
  sequenceSrest,
  SRestPart,
} from "./types/Srest";
import { S3Client } from "@aws-sdk/client-s3";
import { URL } from "url";
import { pipe } from "fp-ts/function";
import { array, readonlyArray, record, taskEither } from "fp-ts";
import { key2URL, srestS3KeyToURLStr } from "./util";
import { taskEitherSeq } from "fp-ts/TaskEither";
import { testDataSet } from "./functions";
import { templateSrest } from "./template";
import * as fs from "fs";
import { writeOutputsToS3 } from "./write";

export function regenerateAnswerData(
  jsonPath: string,
  outJsonPath: string,
  s3: S3Client,
  bucket: string,
  baseS3Key: string,
  libURL: URL
) {
  const dataSet = decodeSRestTestDataSet(
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
        taskEither.chain((idJSXtuples) => {
          return writeOutputsToS3(s3, bucket, baseS3Key, idJSXtuples);
        }),
        taskEither.map((writeResults) => {
          for (const [styleID, answer] of writeResults) {
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

export function test(
  dataSetJsonPath: string,
  Bucket: string,
  s3: S3Client,
  libURL: URL,
  debugImageDir: string
) {
  return pipe(
    JSON.parse(fs.readFileSync(dataSetJsonPath, "utf-8")),
    decodeSRestTestDataSet,
    taskEither.fromEither,
    taskEither.chain((srestTestDataSet) => {
      const srestTestDataArr = pipe(
        srestTestDataSet,
        record.toArray
        // record.collect((_, v) => v)
      );

      const styleIDs = srestTestDataArr.map(([x]) => x);
      const answers = srestTestDataArr.map(([_, x]) => x.answers);
      const _srests = srestTestDataArr.map(([_, x]) => x.srest);

      return pipe(
        _srests,
        array.map(srestS3KeyToURLStr({ Bucket, s3 })),
        array.sequence(taskEitherSeq),
        taskEither.chain((srests) => {
          const aaa = srests.map((srest, idx) => ({
            data: srest,
            styleID: styleIDs[idx],
            answer: answers[idx],
          }));
          return testDataSet(
            aaa,
            Bucket,
            s3,
            debugImageDir,
            templateSrest(libURL)(srests)
          );
        })
      );
    })
  );
}
