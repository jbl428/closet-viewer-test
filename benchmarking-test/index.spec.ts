import { benchmark } from "../src/benchmarking/benchmark";
import { resolve } from "path";
import { S3Client } from "@aws-sdk/client-s3";
import { isRight } from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import { either } from "fp-ts";
import * as fflate from "fflate";
import * as fs from "fs";
import * as http from "http";
import { url } from "../src/util";

var express = require("express");
const serveStatic = require("serve-static");

var app = express();
let listener: http.Server;
// Listen
beforeAll(() => {
  app.use(serveStatic(__dirname, { index: ["default.html", "default.htm"] }));
  listener = app.listen(3311);
});
afterAll(() => {
  listener.close();
});
test(
  "benchmarking",
  () => {
    const zipped = fflate.zipSync({
      "benchmarking.json": fs.readFileSync(
        resolve(__dirname, "artifact", "benchmarking.json")
      ),
    });

    fs.writeFileSync(resolve(__dirname, "artifact.zip"), zipped);

    const s3 = new S3Client({
      region: "ap-northeast-2",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    return benchmark(
      s3,
      "http://localhost:3311/artifact.zip",
      url(
        "https://viewer-library.s3.ap-northeast-2.amazonaws.com/secure-test-2.js"
      ),
      {
        CommitID: "unittest",
      }
    )().then((e) => {
      pipe(e, either.bimap(console.error, console.log));
      expect(isRight(e)).toBeTruthy();
    });
    // return benchmark(resolve(__dirname, "artifact.zip"), s3)().then((e) => {
    //   pipe(e, either.bimap(console.error, console.log));
    //   expect(isRight(e)).toBeTruthy();
    // });
  },
  1000 * 60 * 10
);
