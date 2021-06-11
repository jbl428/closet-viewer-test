import { resolve } from "path";
import {
  _BUCKET,
  makeS3Client,
  testDataProvision,
} from "./test-data-provision";
import { S3Client } from "@aws-sdk/client-s3";
import { isLeft, isRight } from "fp-ts/Either";
import { zrest } from "../src/index";

test(
  "zrest-fail",
  async () => {
    console.log(
      process.env.AWS_ACCESS_KEY_ID!,
      process.env.AWS_SECRET_ACCESS_KEY!
    );
    const aa = zrest.test(
      resolve(__dirname, "zrest-test-data-set.json"),
      resolve(__dirname, "zrest-answer.json"),
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
    const aa = zrest.test(
      resolve(__dirname, "zrest-test-data-set.json"),
      resolve(__dirname, "zrest-answer.json"),
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
  "regen",
  () => {
    return zrest
      .regenerateAnswerData(
        resolve(__dirname, "zrest-test-data-set.json"),
        resolve(__dirname, "zrest-answer.json"),
        makeS3Client(),
        _BUCKET,
        "regen",
        testDataProvision.liburl
      )()
      .then((e) => {
        if (isLeft(e)) {
          console.log(e);
        }
        expect(isRight(e)).toBeTruthy();
      });
  },
  1000 * 60 * 2
);
