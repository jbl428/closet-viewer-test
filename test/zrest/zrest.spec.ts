import { resolve } from "path";
import {
  _BUCKET,
  makeS3Client,
  testDataProvision,
} from "../test-data-provision";
import { S3Client } from "@aws-sdk/client-s3";
import { isLeft, isRight } from "fp-ts/Either";
import { zrest } from "../../src";
import * as fs from "fs";
import { pipe } from "fp-ts/function";
import { decodeAnswerDataSet } from "../../src/types/AnswerData";
import { array, either, record } from "fp-ts";
import { S3Key } from "../../src/types/types";
import { Facets } from "../../src/Facets";
const answerJsonPath = resolve(__dirname, "zrest-answer.json");
test(
  "zrest-fail",
  async () => {
    console.log(
      process.env.AWS_ACCESS_KEY_ID!,
      process.env.AWS_SECRET_ACCESS_KEY!
    );
    const badAnswerJsonPath = resolve(__dirname, "bad-answer.json");
    const badAnswer = pipe(
      fs.readFileSync(answerJsonPath, "utf-8"),
      JSON.parse,
      decodeAnswerDataSet,
      either.map(
        record.map(
          record.map(
            array.map(
              (xx: Facets<S3Key[]>): Facets<S3Key[]> => ({
                back: xx.bottom,
                bottom: xx.back,
                front: xx.left,
                left: xx.front,
                right: xx.left,
                top: xx.bottom,
              })
            )
          )
        )
      )
    );

    if (isLeft(badAnswer)) {
      throw badAnswer.left;
    }

    fs.writeFileSync(badAnswerJsonPath, JSON.stringify(badAnswer.right));

    const aa = zrest.test(
      resolve(__dirname, "zrest-test-data-set.json"),
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
  1000 * 60 * 3
);
