import {
  decodeSRestTestDataSetInput,
  mapSrest,
  sequenceSrest,
  SRestPart,
} from "./types/Srest";
import { S3Client } from "@aws-sdk/client-s3";
import { URL } from "url";
import { pipe } from "fp-ts/function";
import {
  array,
  either,
  eq,
  ord,
  record,
  semigroup,
  set,
  taskEither,
} from "fp-ts";
import { key2URL, srestS3KeyToURLStr } from "./util";
import { taskEitherSeq } from "fp-ts/TaskEither";
import { testDataSet } from "./functions";
import { templateSrest } from "./template";
import * as fs from "fs";
import { writeOutputsToS3 } from "./write";
import {
  AnswerDataSet,
  AnswerDataT,
  decodeAnswerDataSet,
  mapAnswerDataGenericS3KeyToAnswerDataS3Key,
} from "./types/AnswerData";
import { S3Key } from "./types/types";
import { sequenceT } from "fp-ts/Apply";

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
        taskEither.chain((idJSXtuples) => {
          return writeOutputsToS3(s3, bucket, baseS3Key, idJSXtuples);
        }),
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
  const dataSet = pipe(
    JSON.parse(fs.readFileSync(dataSetJsonPath, "utf-8")),
    decodeSRestTestDataSetInput
  );
  const answerSet = pipe(
    JSON.parse(fs.readFileSync(answerJsonPath, "utf-8")),
    decodeAnswerDataSet
  );

  return pipe(
    sequenceT(either.Applicative)(dataSet, answerSet),
    taskEither.fromEither,
    taskEither.chain(([dataSet, answerSet]) => {
      const tkeys = pipe(dataSet, record.keys, set.fromArray(eq.eqString));

      const akeys = pipe(answerSet, record.keys, set.fromArray(eq.eqString));

      const setEq = set.getEq(eq.eqString);

      if (!setEq.equals(tkeys, akeys)) {
        console.error("test data keys");
        tkeys.forEach(console.error);
        console.error("answer data keys");
        akeys.forEach(console.error);
        return taskEither.left(new Error("keys doesn't match") as any);
      }

      const styleIDs = pipe(tkeys, set.toArray(ord.ordString));
      const _srests = styleIDs.map((k) => dataSet[k].srest);
      const answers = styleIDs.map((k) => answerSet[k].answers);
      return pipe(
        _srests,
        array.map(srestS3KeyToURLStr({ Bucket, s3 })),
        array.sequence(taskEitherSeq),
        taskEither.mapLeft((x) => x as any),
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
