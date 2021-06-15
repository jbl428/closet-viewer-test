import * as fs from "fs";
import { resolve } from "path";
import {
  _BUCKET,
  makeS3Client,
  testDataProvision,
} from "../test-data-provision";
import { S3Client } from "@aws-sdk/client-s3";
import { isLeft, isRight, right } from "fp-ts/Either";
import { srest } from "../../src";
import { makeBadAnswer } from "../util";

const successDebugDir = resolve(__dirname, "srest-debug-success");
const typeErrorDebugDir = resolve(__dirname, "srest-debug-type-error");
const failDebugDir = resolve(__dirname, "srest-debug-fail");

beforeAll(() => {
  if (fs.existsSync(successDebugDir)) {
    fs.rmdirSync(successDebugDir, { recursive: true });
  }
  if (fs.existsSync(typeErrorDebugDir)) {
    fs.rmdirSync(typeErrorDebugDir, { recursive: true });
  }
  if (fs.existsSync(failDebugDir)) {
    fs.rmdirSync(failDebugDir, { recursive: true });
  }
});

const dataJsonPath = resolve(__dirname, "srest-test-data-set.json");
const answerJsonPath = resolve(__dirname, "srest-answer.json");
test(
  "srest-success",
  async () => {
    const aa = srest.test(
      dataJsonPath,
      answerJsonPath,
      "viewer-test-model",
      new S3Client({
        region: "ap-northeast-2",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      }),
      testDataProvision.liburl,
      successDebugDir
    );

    const result = await aa();
    if (isRight(result)) {
      expect(result.right).toBe(0);
    } else {
      console.error(result.left);
      expect(false).toBeTruthy();
    }
  },
  1000 * 60 * 3
);

test(
  "srest-fail",
  async () => {
    const badAnswerJsonPath = resolve(__dirname, "bad-answer.json");
    const badAnswerResult = makeBadAnswer(answerJsonPath, badAnswerJsonPath);
    expect(isRight(badAnswerResult)).toBeTruthy();
    const aa = srest.test(
      dataJsonPath,
      badAnswerJsonPath,
      "viewer-test-model",
      new S3Client({
        region: "ap-northeast-2",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      }),
      testDataProvision.liburl,
      typeErrorDebugDir
    );

    const result = await aa();
    expect(result).toStrictEqual(right(24));
  },
  1000 * 60 * 3
);

test(
  "answer regeneration",
  () => {
    return srest
      .regenerateAnswerData(
        dataJsonPath,
        answerJsonPath,
        makeS3Client(),
        _BUCKET,
        "regen",
        testDataProvision.liburl
      )()
      .then((e) => {
        if (isLeft(e)) {
          console.log(e.left);
        }
        expect(isRight(e)).toBeTruthy();
      });
  },
  1000 * 60 * 2
);
