import { URL } from "url";
import { S3Client } from "@aws-sdk/client-s3";

export const testDataProvision = {
  bad: new URL("https://viewer-library.s3.ap-northeast-2.amazonaws.com/d.js"),
  liburl: new URL(
    "https://viewer-library.s3.ap-northeast-2.amazonaws.com/tq-captures/rv.js"
  ),
  srestURLs: [
    "https://viewer-test-model.s3.ap-northeast-2.amazonaws.com/srests/8da914c6-fe27-4dbf-9e89-a6e3f42bb72b/010074390d0848e0bb75184e53efebfa/srest.json",
    "https://viewer-test-model.s3.ap-northeast-2.amazonaws.com/srests/8da914c6-fe27-4dbf-9e89-a6e3f42bb72b/1d55ad72560142a486e6a97deebcbcbe/srest.json",
    "https://viewer-test-model.s3.ap-northeast-2.amazonaws.com/srests/8da914c6-fe27-4dbf-9e89-a6e3f42bb72b/f9a05f55233744d2881c6ee939e14650/srest.json",
    "https://viewer-test-model.s3.ap-northeast-2.amazonaws.com/srests/8da914c6-fe27-4dbf-9e89-a6e3f42bb72b/8ce76da69d4a4a5ea4ae8726e14e48a0/srest.json",
    "https://viewer-test-model.s3.ap-northeast-2.amazonaws.com/srests/8da914c6-fe27-4dbf-9e89-a6e3f42bb72b/9ad0188d578543f4ad1172cb69665e21/srest.json",
    "https://viewer-test-model.s3.ap-northeast-2.amazonaws.com/srests/8da914c6-fe27-4dbf-9e89-a6e3f42bb72b/5bf6c90e9b1b4829969ac1d9c31b27bc/srest.json",
  ],
  zrestURLs: [
    "https://viewer-test-model.s3.ap-northeast-2.amazonaws.com/00000000.zrest",
    "https://viewer-test-model.s3.ap-northeast-2.amazonaws.com/00000001.zrest",
    "https://viewer-test-model.s3.ap-northeast-2.amazonaws.com/00000002.zrest",
    "https://viewer-test-model.s3.ap-northeast-2.amazonaws.com/00000003.zrest",
    "https://viewer-test-model.s3.ap-northeast-2.amazonaws.com/00000004.zrest",
    "https://viewer-test-model.s3.ap-northeast-2.amazonaws.com/00000005.zrest",
  ].map((x) => new URL(x)),
};

export function makeS3Client() {
  return new S3Client({
    region: "ap-northeast-2",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

export const _BUCKET = "viewer-test-model";
