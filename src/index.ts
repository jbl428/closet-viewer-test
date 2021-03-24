import { SRestTestDataSet, ZRestTestDataSet } from "./types";
import { S3Client } from "@aws-sdk/client-s3";
import { URL } from "url";
import { pipe } from "fp-ts/function";
import { array, record, taskEither } from "fp-ts";
import { key2URL } from "./util";
import { teSequenceArrayConcat } from "./extension";
import { templateSrest, templateZrest } from "./template";
import { testDataSet } from "./functions";

export function testSrest(
  srestTestDataSet: SRestTestDataSet,
  Bucket: string,
  s3: S3Client,
  libURL: URL,
  debugImageDir: string
) {
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
    array.map(record.map(array.map((key) => key2URL(key.str, Bucket, s3)))),
    array.map(record.map(teSequenceArrayConcat)),
    array.map(record.sequence(taskEither.taskEither)),
    teSequenceArrayConcat,
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
}

export function testZrest(
  zrestTestDataSet: ZRestTestDataSet,
  Bucket: string,
  s3: S3Client,
  libURL: URL,
  debugImageDir: string
) {
  const arr = pipe(zrestTestDataSet, record.toArray);

  const styleIDs = arr.map(([x]) => x);
  const answers = arr.map(([_, x]) => x.answers);
  const keys = arr.map(([_, x]) => x.key);

  const zrestURLs = teSequenceArrayConcat(
    keys.map((x) => key2URL(x.str, Bucket, s3))
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
}
