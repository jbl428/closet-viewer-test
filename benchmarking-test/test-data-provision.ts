import { TestDataProvision } from "./provision-type";
import { URL } from "url";

export const testDataProvision: TestDataProvision = {
  liburl: new URL(
    "https://viewer-library.s3.ap-northeast-2.amazonaws.com/closet.viewer-2345678.js"
  ),
  zrestURLs: [
    "https://viewer-test-model.s3.ap-northeast-2.amazonaws.com/00000000.zrest",
    "https://viewer-test-model.s3.ap-northeast-2.amazonaws.com/00000001.zrest",
    "https://viewer-test-model.s3.ap-northeast-2.amazonaws.com/00000002.zrest",
  ].map((x) => new URL(x)),
  srestJsonURLs: [
    "https://viewer-test-model.s3.ap-northeast-2.amazonaws.com/srests/8da914c6-fe27-4dbf-9e89-a6e3f42bb72b/010074390d0848e0bb75184e53efebfa/srest.json",
    "https://viewer-test-model.s3.ap-northeast-2.amazonaws.com/srests/8da914c6-fe27-4dbf-9e89-a6e3f42bb72b/1d55ad72560142a486e6a97deebcbcbe/srest.json",
    "https://viewer-test-model.s3.ap-northeast-2.amazonaws.com/srests/8da914c6-fe27-4dbf-9e89-a6e3f42bb72b/f9a05f55233744d2881c6ee939e14650/srest.json",
  ],
  heavy:
    "https://viewer-test-model.s3.ap-northeast-2.amazonaws.com/00000000.zrest",
};
