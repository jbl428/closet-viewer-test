import { textureQuality } from "../src/index";
import { resolve } from "path";
import { S3Client } from "@aws-sdk/client-s3";
import { URL } from "url";
import { isLeft, isRight } from "fp-ts/Either";
import { either } from "fp-ts";

function makeS3() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  if (accessKeyId === undefined) throw "Can't find AWS_ACCESS_KEY_ID";
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (secretAccessKey === undefined) throw "Can't find secretAccessKey";
  return new S3Client({
    region: "ap-northeast-2",
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}
function getEmail() {
  const email = process.env.CLOSET_USER_EMAIL;
  if (email === undefined) throw "Please set CLOSET_USER_EMAIL";
  return email;
}
function getPassworrd() {
  const password = process.env.CLOSET_USER_PASSWORD;
  if (password === undefined) throw "Please set CLOSET_USER_PASSWORD";
  return password;
}
test(
  "generate answer",
  () => {
    return textureQuality
      .generateAnswer(
        {
          baseS3Key: "tq",
          bucket: "viewer-test-model",
          email: getEmail(),
          libURL: new URL(
            "https://viewer-library.s3.ap-northeast-2.amazonaws.com/tq-captures/rv.js"
          ),
          password: getPassworrd(),
          s3: makeS3(),
        },
        resolve(__dirname, "tq.json"),
        resolve(__dirname, "tq-answer.json")
      )()
      .then((e) => {
        if (isLeft(e)) {
          console.error(e);
        }

        expect(isRight(e)).toBeTruthy();
      });
  },
  1000 * 60 * 3
);

test(
  "test",
  () => {
    return textureQuality
      .test(
        {
          email: getEmail(),
          password: getPassworrd(),
          s3: makeS3(),
          libURL: new URL(
            "https://viewer-library.s3.ap-northeast-2.amazonaws.com/tq-captures/rv.js"
          ),
        },
        resolve(__dirname, "tq.json"),
        resolve(__dirname, "tq-debug"),
        resolve(__dirname, "tq-answer.json")
      )()
      .then((e) => {
        if (isLeft(e)) {
          console.error(e.left);
        }
        expect(e).toStrictEqual(either.right(0));
      });
  },
  1000 * 60
);
