import { pipe } from "fp-ts/function";
import * as fs from "fs";
import { resolve } from "path";
import { decodeSRestTestDataSet } from "../src/types";
import { either, taskEither } from "fp-ts";
import { testDataProvision } from "./test-data-provision";
import { S3Client } from "@aws-sdk/client-s3";
import { isRight } from "fp-ts/Either";
import { testSrest } from "../src";

test(
  "srest",
  async () => {
    console.log(
      process.env.AWS_ACCESS_KEY_ID!,
      process.env.AWS_SECRET_ACCESS_KEY!
    );
    const aa = pipe(
      fs.readFileSync(resolve(__dirname, "srest-test-data-set.json"), "utf-8"),
      JSON.parse,
      decodeSRestTestDataSet,
      either.map((sDataset) => {
        return testSrest(
          sDataset,
          "viewer-test-model",
          new S3Client({
            region: "ap-northeast-2",
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
          }),
          testDataProvision.liburl,
          resolve(__dirname, "debug")
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
