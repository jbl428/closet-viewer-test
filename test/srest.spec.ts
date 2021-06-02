import * as fs from "fs";
import { resolve } from "path";
import {
  _BUCKET,
  makeS3Client,
  testDataProvision,
} from "./test-data-provision";
import { S3Client } from "@aws-sdk/client-s3";
import { isLeft, isRight } from "fp-ts/Either";
import { URL } from "url";
import { srest } from "../src/index";

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

test(
  "srest-success",
  async () => {
    const jsonPath = resolve(__dirname, "srest-test-data-set.json");
    const aa = srest.test(
      jsonPath,
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
  "srest-type-error",
  async () => {
    const jsonpath = resolve(__dirname, "srest-test-data-set.json");
    const aa = srest.test(
      jsonpath,
      "viewer-test-model",
      new S3Client({
        region: "ap-northeast-2",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      }),
      testDataProvision.bad,
      typeErrorDebugDir
    );

    const result = await aa();
    if (isRight(result)) {
      expect(false).toBeTruthy();
    } else {
      console.log(result.left);
      expect(true).toBeTruthy();
    }
  },
  1000 * 60 * 3
);

test(
  "srest-fail",
  async () => {
    const jsonPath = resolve(__dirname, "srest-test-data-set.json");
    const aa = srest.test(
      jsonPath,
      "viewer-test-model",
      new S3Client({
        region: "ap-northeast-2",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      }),
      new URL(
        "https://viewer-library.s3.ap-northeast-2.amazonaws.com/reverse-render-order.js"
      ),
      failDebugDir
    );

    const result = await aa();
    if (isRight(result)) {
      expect(result.right).toBe(10);
    } else {
      console.log(result.left);
      expect(false).toBeTruthy();
    }
  },
  1000 * 60 * 3
);

test(
  "answer regeneration",
  () => {
    return srest
      .regenerateAnswerData(
        resolve(__dirname, "srest-test-data-set.json"),
        resolve(__dirname, "srest-regen.json"),
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
