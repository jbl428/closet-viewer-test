import * as fflate from "fflate";
import { AsyncUnzipInflate } from "fflate";
import { TaskEither, tryCatchK } from "fp-ts/TaskEither";
import { pipe } from "fp-ts/function";
import { array, readonlyArray, task, taskEither } from "fp-ts";
import {
  BenchmarkingDefinition,
  BenchmarkingTask,
  decodeBenchmarkingDefinition,
  Result,
} from "./types";
import {
  benchmarkBundleSize,
  benchmarkFPS,
  benchmarkSrestLoadingWithSrests,
  benchmarkZrestLoading,
} from "./benchmarkings";
import { URL } from "url";
import { key2URL, srestS3KeyToURLStr } from "../util";
import { S3Client } from "@aws-sdk/client-s3";
import { teSequenceArrayConcat } from "../extension";
import fetch from "node-fetch";
import { v4 } from "uuid";
import { DynamoM, encodeDynamoFormat } from "./util";

const url = (str: string) => new URL(str);

function _unzip(artifactURL: string) {
  return new Promise<Buffer>((done, reject) => {
    let jsonChunks: Uint8Array[] = [];
    const unzip = new fflate.Unzip((stream) => {
      if (stream.name.split("/").reverse()[0] === "benchmarking.json") {
        stream.ondata = (err, data, final) => {
          if (err) reject(err);
          jsonChunks.push(data);
          if (final) done(Buffer.concat(jsonChunks));
        };
        stream.start();
      }
    });

    unzip.register(AsyncUnzipInflate);
    fetch(artifactURL)
      .then((xx) => xx.buffer())
      .then((x) => unzip.push(x, true));
  });
}

const unzip = tryCatchK(_unzip, (x) => x);

export function benchmark(
  s3: S3Client,
  artifactURL: string,
  libURL: URL,
  meta: { [property: string]: string }
) {
  return pipe(
    unzip(artifactURL),
    taskEither.chainEitherKW((jsonBuf) => {
      return pipe(
        jsonBuf.toString("utf-8"),
        JSON.parse,
        decodeBenchmarkingDefinition
      );
    }),
    taskEither.chain((benchmarkData) =>
      benchmarkCore(
        s3,
        benchmarkData,
        libURL,
        benchmarkData.apiEndpoint,
        benchmarkData.TableName,
        meta
      )
    )
  );
}

const _postJSON = (endpoint: string, jsonStr: string) =>
  fetch(endpoint, {
    method: "post",
    body: jsonStr,
    headers: { "Content-Type": "application/json" },
  });

const postJSON = tryCatchK(_postJSON, (x) => x);

function benchmarkCore(
  s3: S3Client,
  benchmarkData: BenchmarkingDefinition,
  libURL: URL,
  endpoint: string,
  tableName: string,
  meta: { [property: string]: string }
) {
  const aggregated = pipe(
    benchmarkData.tasks,
    array.map((taskData) =>
      pipe(
        () => Promise.resolve(console.log("Benchmarking start", taskData.name)),
        task.chain(() =>
          benchmarkUnit(s3, taskData, libURL, benchmarkData.Bucket)
        )
      )
    ),
    teSequenceArrayConcat,
    taskEither.map(
      readonlyArray.reduceRight({}, (result, agg: Result) => {
        return { ...result, ...agg };
      })
    )
  );

  const encoded = pipe(
    aggregated,
    taskEither.map((aggregatedBenchmark) => ({
      id: v4().substring(0, 16),
      report: {
        benchmarks: aggregatedBenchmark,
        meta,
      },
    })),
    taskEither.chainEitherKW(encodeDynamoFormat),
    taskEither.map((xx) => {
      return (xx as DynamoM).M;
    })
  );

  return pipe(
    encoded,
    taskEither.chain((body) => {
      const jsonStr = JSON.stringify({
        TableName: tableName,
        Item: body,
      });
      console.log("putting", jsonStr);
      return postJSON(endpoint, jsonStr);
    })
  );
}

function benchmarkUnit(
  s3: S3Client,
  taskData: BenchmarkingTask,
  libURL: URL,
  Bucket: string
): TaskEither<unknown, Result> {
  switch (taskData.type) {
    case "bundleSize":
      return benchmarkBundleSize(libURL, taskData.name);
    case "srestLoading":
      return pipe(
        taskData.srests,
        array.map(srestS3KeyToURLStr({ Bucket, s3 })),
        teSequenceArrayConcat,
        taskEither.chainW((srests) => {
          return benchmarkSrestLoadingWithSrests(libURL, srests, taskData.name);
          // return pipe(t,taskEither.mapLeft(x=>x as any))
        })
      );
    case "zrestLoading":
      return pipe(
        taskData.zrestS3Keys,
        array.map((s3k) => key2URL(s3k.str, Bucket, s3)),
        teSequenceArrayConcat,
        taskEither.chain((zrestURLs) => {
          return benchmarkZrestLoading(
            libURL,
            zrestURLs.map(url),
            taskData.name
          );
        })
      );
    case "fps":
      return pipe(
        key2URL(taskData.zrestS3Key.str, Bucket, s3),
        taskEither.chainW((zrestURL) =>
          benchmarkFPS(
            libURL,
            url(zrestURL),
            taskData.viewWidth,
            taskData.viewHeight,
            taskData.timeMS,
            taskData.name
          )
        )
      );
  }
}
