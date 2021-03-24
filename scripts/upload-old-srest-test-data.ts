#!/usr/bin/env npx ts-node

import { URL } from "url";
import { identity, pipe } from "fp-ts/function";
import { array, either, readonlyArray, record, taskEither } from "fp-ts";
import * as fs from "fs";
import { readdirSync } from "fs";

import { basename, dirname, join, resolve } from "path";
import { from, zip } from "rxjs";
import { concatMap, map, toArray } from "rxjs/operators";
import { writeAnswer, writeSRest } from "../src/write-secret-test-data";
import { S3Client } from "@aws-sdk/client-s3";
import { observableEither } from "fp-ts-rxjs";
import { getLastSemigroup } from "fp-ts/Semigroup";
import { isLeft } from "fp-ts/Either";
import fetch from "node-fetch";
import { tryCatchK } from "fp-ts/TaskEither";
import { sequenceT } from "fp-ts/Apply";
import { decodeSRest, tup } from "../src/types";
import {
  CommandLineParser,
  CommandLineStringParameter,
} from "@rushstack/ts-command-line";
import { legacySrestJsonURLs, provision } from "./data/provision";
import { facetFromArray } from "../src/Facets";

const answers = pipe(
  readdirSync(provision.legacySrestAnswerDir)
    .filter((x) => x.endsWith(".png"))
    .map((x) =>
      tup(basename(x, ".png"), [resolve(provision.legacySrestAnswerDir, x)])
    ),
  record.fromFoldable(getLastSemigroup<string[]>(), array.array),
  record.mapWithIndex((k, v) => {
    const alterDir = resolve(provision.legacySrestAnswerDir, k);
    if (fs.existsSync(alterDir)) {
      v = v.concat(
        readdirSync(alterDir)
          .filter((x) => x.endsWith(".png"))
          .map((x) => resolve(alterDir, x))
      );
    }
    return v;
  }),
  record.toArray,
  (arr) => arr.sort((x, y) => (x[0] < y[0] ? -1 : 1)),
  array.map((x) => x[1]),
  array.chunksOf(6),
  array.map((xs) => {
    return facetFromArray(xs);
  })
);

const versionID = encodeURIComponent(new Date().toISOString());
const fetchText = tryCatchK(
  (jsonURL: string) => fetch(jsonURL).then((x) => x.text()),
  identity
);

function extractStyleID(s: string) {
  return basename(dirname(s));
}

class CLI extends CommandLineParser {
  bucket: CommandLineStringParameter;
  credential: CommandLineStringParameter;

  constructor() {
    super({
      toolDescription: "upload old srest test data",
      toolFilename: "upload-old-srest-test-data.ts",
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
  }

  protected onDefineParameters(): void {}

  protected onExecute(): Promise<void> {
    const [accessKeyId, secretAccessKey] = fs
      .readFileSync(this.credential.value!, "utf-8")
      .split("\n")[1]
      .split(",")
      .map((x) => x.trim());

    const s3 = new S3Client({
      region: provision.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    return new Promise((done) => {
      zip(from(legacySrestJsonURLs), answers)
        .pipe(
          concatMap(([jsonURL, answers]) => {
            const styleID = extractStyleID(jsonURL);
            const baseKey = join(versionID, styleID);

            const keySrest = pipe(
              fetchText(jsonURL),
              taskEither.map(JSON.parse),
              taskEither.chainEitherKW(decodeSRest),
              taskEither.map(record.map(array.map((x) => new URL(x)))),
              taskEither.chain(writeSRest(s3, baseKey, this.bucket.value!))
            );

            const answerBuffers = pipe(
              answers,
              record.map(array.map((x) => fs.readFileSync(x)))
            );

            const keyAnswers = writeAnswer(
              s3,
              this.bucket.value!,
              baseKey
            )(answerBuffers);

            return pipe(
              sequenceT(taskEither.taskEither)(keySrest, keyAnswers),
              taskEither.map(([srest, answers]) => ({
                styleID,
                srest,
                answers,
              }))
            )();
          }),
          observableEither.map(({ styleID, srest, answers }) =>
            tup(styleID, { srest, answers })
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
            fs.writeFileSync("legacy-srest.json", JSON.stringify(obj));
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
}

new CLI().execute().catch(console.error);
