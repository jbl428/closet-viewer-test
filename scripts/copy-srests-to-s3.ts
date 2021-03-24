#!/usr/bin/env npx ts-node
import {
  CommandLineParser,
  CommandLineStringListParameter,
  CommandLineStringParameter,
} from "@rushstack/ts-command-line";
import { pipe } from "fp-ts/function";
import { array, readonlyArray, record, taskEither } from "fp-ts";
import { fetchSrest_styleid } from "../src/util";
import { first } from "rxjs/operators";
import { writeAnswer, writeSRest } from "../src/write-secret-test-data";
import { S3Client } from "@aws-sdk/client-s3";
import fs from "fs";
import { join } from "path";
import { URL } from "url";
import { tup } from "../src/types";
import { isRight } from "fp-ts/Either";
import { fromFoldable } from "fp-ts/Record";
import { getLastSemigroup } from "fp-ts/Semigroup";
import { generateScreenshots } from "../src/functions";
import { teSequenceArrayConcat } from "../src/extension";
import { toTaskEither } from "fp-ts-rxjs/lib/ObservableEither";
import { sequenceT } from "fp-ts/Apply";
import { templateSrest } from "../src/template";

function copySrestsToS3(
  styleIDs: readonly string[],
  domain: string,
  token: string,
  versionID: string,
  s3: S3Client,
  bucket: string,
  outputFile: string,
  libURL: string
) {
  const srestDataSet = pipe(
    styleIDs,
    readonlyArray.map((sid) => {
      return pipe(
        fetchSrest_styleid(domain, token)(sid),
        taskEither.chain((srestStr) => {
          const baseS3Key = join(versionID, sid);

          const srestS3Key = pipe(
            srestStr,
            record.map(array.map((x) => new URL(x))),
            writeSRest(s3, baseS3Key, bucket)
          );

          const answerForEachFacet = generateScreenshots((answerStream) => {
            const x = answerStream.pipe(first());
            return toTaskEither(x);
          }, templateSrest(new URL(libURL))([srestStr]));

          const answerS3Key = pipe(
            answerForEachFacet,
            taskEither.map(record.map((x) => [x])),
            // taskEither.map(record.map((x) => [x])),
            taskEither.chain(
              writeAnswer(s3, bucket, join(baseS3Key, "answers"))
            )
          );

          return pipe(
            sequenceT(taskEither.taskEither)(srestS3Key, answerS3Key),
            taskEither.map(([srest, answers]) => {
              return { srest, answers };
            }),
            taskEither.map((x) => tup(sid, x))
          );
        })
      );
    }),
    teSequenceArrayConcat,
    taskEither.map((dataset) => {
      return fromFoldable(
        getLastSemigroup<typeof dataset[0][1]>(),
        readonlyArray.readonlyArray
      )(dataset);
    })
  );

  srestDataSet().then((xx) => {
    if (isRight(xx)) {
      fs.writeFileSync(outputFile, JSON.stringify(xx.right));
    } else {
      console.error(xx.left);
    }
  });
}

export class CLI extends CommandLineParser {
  private token: CommandLineStringParameter;

  private domain: CommandLineStringParameter;
  private bucket: CommandLineStringParameter;

  private styleIDs: CommandLineStringListParameter;
  private credential: CommandLineStringParameter;
  private out: CommandLineStringParameter;
  private libURL: CommandLineStringParameter;

  public constructor() {
    super({
      toolFilename: "copy-srests-to-s3.ts",
      toolDescription: "copy srests from CLOSET to s3",
    });

    this.token = this.defineStringParameter({
      argumentName: "TOKEN",
      description: "CLOSET token",
      parameterLongName: "--token",
      required: true,
    });
    this.styleIDs = this.defineStringListParameter({
      argumentName: "STYLEIDS",
      description: "style ids",
      parameterLongName: "--style",
      required: true,
    });
    this.domain = this.defineStringParameter({
      argumentName: "DOMAIN",
      description: "domain to CLOSET",
      parameterLongName: "--domain",
      required: true,
    });
    this.bucket = this.defineStringParameter({
      argumentName: "BUCKET",
      description: "s3 bucket name",
      parameterLongName: "--bucket",
      required: true,
    });
    this.credential = this.defineStringParameter({
      argumentName: "CREDENTIAL",
      description: "credential file",
      parameterLongName: "--cred",
      required: true,
    });
    this.out = this.defineStringParameter({
      argumentName: "OUT",
      description: "output file",
      parameterLongName: "--out",
      required: true,
    });
    this.libURL = this.defineStringParameter({
      argumentName: "LIB",
      description: "url to lib",
      parameterLongName: "--lib",
      required: true,
    });
  }

  protected onDefineParameters(): void {}

  protected async onExecute(): Promise<void> {
    // override
    const [accessKeyId, secretAccessKey] = fs
      .readFileSync(this.credential.value!, "utf-8")
      .split("\n")[1]
      .split(",")
      .map((x) => x.trim());

    const s3 = new S3Client({
      region: "ap-northeast-2",
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const styleIDs = this.styleIDs.values;
    const token = this.token.value!;
    const domain = this.domain.value!;
    const versionID = new Date().toISOString();
    const outputFile = this.out.value!;
    const bucket = this.bucket.value!;

    copySrestsToS3(
      styleIDs,
      domain,
      token,
      versionID,
      s3,
      bucket,
      outputFile,
      this.libURL.value!
    );
  }
}

new CLI().execute();
