import {
  CommandLineParser,
  CommandLineRemainder,
  CommandLineStringParameter,
} from "@rushstack/ts-command-line";
import { benchmark } from "../benchmarking/benchmark";
import { S3Client } from "@aws-sdk/client-s3";
import { pipe } from "fp-ts/function";
import { either, readonlyArray, record } from "fp-ts";
import { getLastSemigroup } from "fp-ts/Semigroup";
import { tup } from "../types";
import { url } from "../util";

export class BenchmarkCLI extends CommandLineParser {
  private libURL: CommandLineStringParameter;
  private artifactURL: CommandLineStringParameter;
  private meta: CommandLineRemainder;

  public constructor() {
    super({
      toolFilename: "widget",
      toolDescription:
        'The "widget" tool is a code sample for using the @rushstack/ts-command-line library.',
    });

    this.libURL = this.defineStringParameter({
      argumentName: "LIB",
      description: "url to library",
      parameterLongName: "--lib-url",
      parameterShortName: "-l",
      required: true,
    });
    this.artifactURL = this.defineStringParameter({
      argumentName: "ARTIFACTURL",
      description: "url to artifact",
      parameterLongName: "--artifact",
      parameterShortName: "-a",
      required: true,
    });
    this.meta = this.defineCommandLineRemainder({
      description:
        "Define meta here. e.g, AuthorDate 1993-10-08 CommitId 1234567",
    });
  }

  protected onDefineParameters(): void {
    // abstract
  }

  protected onExecute(): Promise<void> {
    // override
    const flatMeta = this.meta.values ?? [];
    const meta = pipe(
      flatMeta,
      readonlyArray.chunksOf(2),
      readonlyArray.map(([x, y]) => tup(x, y)),
      record.fromFoldable(
        getLastSemigroup<string>(),
        readonlyArray.readonlyArray
      )
    );

    benchmark(
      new S3Client({ region: "ap-northeast-2" }),
      this.artifactURL.value!,
      url(this.libURL.value!),
      meta
    )().then(either.bimap(console.error, console.log));
    return super.onExecute();
  }
}
