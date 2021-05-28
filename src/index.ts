import { addSlash } from "./types/types";
import { S3Client } from "@aws-sdk/client-s3";
import { URL } from "url";
import { pipe } from "fp-ts/function";
import { array, record, taskEither } from "fp-ts";
import { key2URL, srestS3KeyToURLStr } from "./util";
import { templateSrest, templateZrest } from "./template";
import { testDataSet } from "./functions";
import { Config, copyToS3, readSrestFromSID, readZrestFromSID } from "./write";
import fetch from "node-fetch";
import { taskEitherSeq, tryCatchK } from "fp-ts/TaskEither";
import { SRestTestDataSet } from "./types/Srest";
import { ZRestTestDataSet } from "./types/Zrest";

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
}

export function copyZrestToS3(styleIDs: string[], config: Config) {
  return copyToS3(
    styleIDs,
    config.s3,
    config.bucket,
    config.baseKey,
    readZrestFromSID
  )(config);
}

export function copySrestToS3(styleIDs: string[], config: Config) {
  return copyToS3(
    styleIDs,
    config.s3,
    config.bucket,
    config.baseKey,
    readSrestFromSID
  )(config);
}

type Account = {
  domain: string;
  email: string;
  password: string;
};

export function getClosetToken({ domain, email, password }: Account) {
  const safeEmail = encodeURIComponent(email);
  const safePass = encodeURIComponent(password);
  const url =
    addSlash(domain) +
    "api/auth/token?email=" +
    safeEmail +
    "&password=" +
    safePass;
  const getter = () =>
    fetch(url, {
      headers: {
        "api-version": "2.0",
      },
    }).then((x) => x.text());
  return tryCatchK(getter, (err) => {
    console.error("Getting Token failed", err);
    return new Error("Getting Token failed");
  })();
}

export { fetchSrest_styleid } from "./write";
