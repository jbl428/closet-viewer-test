#!/usr/bin/env npx ts-node

import { URL } from "url";
import { pipe } from "fp-ts/function";
import { array, either, readonlyArray, record, taskEither } from "fp-ts";
import { legacyAnswerDir, legacyZrestURLs, provision } from "./data/provision";
import * as fs from "fs";
import { readdirSync } from "fs";

import { resolve, basename } from "path";
import { from, zip } from "rxjs";
import { concatMap, map, toArray } from "rxjs/operators";
import { writeZrestTestData } from "../src/write-secret-test-data";
import { S3Client } from "@aws-sdk/client-s3";
import { observableEither } from "fp-ts-rxjs";
import { getLastSemigroup } from "fp-ts/Semigroup";
import { isLeft } from "fp-ts/Either";
import { tup } from "../src/types";
import {
  CommandLineParser,
  CommandLineStringParameter,
} from "@rushstack/ts-command-line";
import { downloadBuffer } from "../src/util";
import { facetFromArray } from "../src/Facets";

const answers = pipe(
  readdirSync(legacyAnswerDir)
    .filter((x) => x.endsWith(".png"))
    .sort()
    .map((x) => resolve(legacyAnswerDir, x)),
  array.chunksOf(6)
);

class CLI extends CommandLineParser {
  bucket: CommandLineStringParameter;
  credential: CommandLineStringParameter;

  protected onDefineParameters(): void {}

  protected onExecute(): Promise<void> {
    const [accessKeyId, secretAccessKey] = fs
      .readFileSync(this.credential.value!, "utf-8")
      .split("\n")[1]
      .split(",")
      .map((x) => x.trim());
    const writer = writeZrestTestData(
      new S3Client({
        region: provision.region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      }),
      this.bucket.value!,
      encodeURIComponent(new Date().toISOString())
    );

    return new Promise((done) => {
      zip(from(legacyZrestURLs), answers)
        .pipe(
          concatMap(([url, answers]) => {
            const styleID = basename(new URL(url).pathname, ".zrest");
            const bufferTask = downloadBuffer(url);
            const answerBuffers = pipe(
              answers,
              array.map((x) => [fs.readFileSync(x)])
            );

            return pipe(
              bufferTask,
              taskEither.chain((zrestBuffer) => {
                return writer({
                  zrest: zrestBuffer,
                  styleID,
                  answersForFacets: facetFromArray(answerBuffers),
                });
              })
            )();
          }),
          observableEither.map(({ styleID, answerKeys, zrestKey }) =>
            tup(styleID, { key: zrestKey, answers: answerKeys })
          ),
          toArray(),
          map(either.sequenceArray),
          observableEither.map((arr) =>
            record.fromFoldable(
              getLastSemigroup<typeof arr[0][1]>(),
              readonlyArray.readonlyArray
            )(arr)
          ),
          observableEither.map((obj) => {
            fs.writeFileSync("legacy-zrest.json", JSON.stringify(obj));
          })
        )
        .subscribe({
          next(result) {
            if (isLeft(result)) {
              console.error(result.left);
            }
          },
          error(err) {
            console.error(err);
            done();
          },
          complete: done,
        });
    });
  }

  constructor() {
    super({
      toolDescription: "upload old zrest test data",
      toolFilename: "upload-old-zrest-test-data.ts",
    });
    this.bucket = this.defineStringParameter({
      argumentName: "BUCKET",
      description: "S3-BUCKET-NAME",
      parameterLongName: "--bucket",
      required: true,
    });
    this.credential = this.defineStringParameter({
      argumentName: "CREDENTIAL",
      description: "credential csv path",
      parameterLongName: "--cred",
      required: true,
    });
    this.credential = this.defineStringParameter({
      argumentName: "CREDENTIAL",
      description: "credential csv path",
      parameterLongName: "--cred",
      required: true,
    });
  }
}

new CLI().execute().catch(console.error);
