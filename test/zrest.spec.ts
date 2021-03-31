import { pipe } from "fp-ts/function";
import * as fs from "fs";
import { resolve } from "path";
import { either, taskEither } from "fp-ts";
import { testDataProvision } from "./test-data-provision";
import { S3Client } from "@aws-sdk/client-s3";
import { isRight } from "fp-ts/Either";
import { testZrest } from "../src";
import { decodeZRestTestDataSet } from "../src/types/Zrest";

test(
  "zrest-fail",
  async () => {
    console.log(
      process.env.AWS_ACCESS_KEY_ID!,
      process.env.AWS_SECRET_ACCESS_KEY!
    );
    const aa = pipe(
      fs.readFileSync(resolve(__dirname, "zrest-test-data-set.json"), "utf-8"),
      JSON.parse,
      decodeZRestTestDataSet,
      either.map((zdataset) => {
        return testZrest(
          zdataset,
          "viewer-test-model",
          new S3Client({
            region: "ap-northeast-2",
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
          }),
          testDataProvision.bad,
          resolve(__dirname, "zrest-debug-fail")
        );
      }),
      either.sequence(taskEither.taskEither),
      taskEither.chainEitherKW((x) => x)
    );

    const result = await aa();
    if (isRight(result)) {
      expect(result.right).toBe(36);
    } else {
      console.error(result.left);
      expect(false).toBeTruthy();
    }
  },
  1000 * 60 * 3
);

test(
  "zrest-success",
  async () => {
    console.log(
      process.env.AWS_ACCESS_KEY_ID!,
      process.env.AWS_SECRET_ACCESS_KEY!
    );
    const aa = pipe(
      fs.readFileSync(resolve(__dirname, "zrest-test-data-set.json"), "utf-8"),
      JSON.parse,
      decodeZRestTestDataSet,
      either.map((zdataset) => {
        return testZrest(
          zdataset,
          "viewer-test-model",
          new S3Client({
            region: "ap-northeast-2",
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
          }),
          testDataProvision.liburl,
          resolve(__dirname, "zrest-debug-success")
        );
      }),
      either.sequence(taskEither.taskEither),
      taskEither.chainEitherKW((x) => x)
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
