import * as D from "io-ts/Decoder";
import { S3Key_D, SRest_D_S3Key } from "../types";
import { getStructMonoid, Monoid, monoidSum } from "fp-ts/Monoid";

const BenchmarkingTask = D.sum("type")({
  bundleSize: D.type({
    type: D.literal("bundleSize"),
    name: D.string,
  }),
  zrestLoading: D.type({
    type: D.literal("zrestLoading"),
    name: D.string,

    zrestS3Keys: D.array(S3Key_D),
  }),
  srestLoading: D.type({
    type: D.literal("srestLoading"),
    name: D.string,

    srests: D.array(SRest_D_S3Key),
  }),
  fps: D.type({
    type: D.literal("fps"),
    name: D.string,

    zrestS3Key: S3Key_D,
    timeMS: D.number,
    viewWidth: D.number,
    viewHeight: D.number,
  }),
});
export type BenchmarkingTask = D.TypeOf<typeof BenchmarkingTask>;
export const decodeBenchmarkingTask = BenchmarkingTask.decode;

const BenchmarkingDefinition = D.type({
  Bucket: D.string,
  apiEndpoint: D.string,
  TableName: D.string,
  tasks: D.array(BenchmarkingTask),
});
export type BenchmarkingDefinition = D.TypeOf<typeof BenchmarkingDefinition>;
export const decodeBenchmarkingDefinition = BenchmarkingDefinition.decode;

export class Measurement {
  constructor(public unit: string, public value: number) {}
}

export type Result = Record<string, Record<string, Measurement>>;

export const metricSumMonoid = getStructMonoid({
  Timestamp: monoidSum,
  /** Number of documents in the page. */
  Documents: monoidSum,
  /** Number of events in the page. */
  JSEventListeners: monoidSum,
  /** Number of DOM nodes in the page. */
  Nodes: monoidSum,
  /** Total monoidSum of full or partial page layout. */
  LayoutCount: monoidSum,
  /** Total monoidSum of page style recalculations. */
  RecalcStyleCount: monoidSum,
  /** Combined durations of all page layouts. */
  LayoutDuration: monoidSum,
  /** Combined duration of all page style recalculations. */
  RecalcStyleDuration: monoidSum,
  /** Combined duration of JavaScript execution. */
  ScriptDuration: monoidSum,
  /** Combined duration of all tasks performed by the browser. */
  TaskDuration: monoidSum,
  /** Used JavaScript heap size. */
  JSHeapUsedSize: monoidSum,
  /** Total JavaScript heap size. */
  JSHeapTotalSize: monoidSum,
});
export const monoidMax: Monoid<number> = {
  concat: Math.max,
  empty: 0,
};
export const monoidMin: Monoid<number> = {
  concat: Math.min,
  empty: Number.MAX_VALUE,
};
export const metricMaxMonoid = getStructMonoid({
  Timestamp: monoidMax,
  /** Number of documents in the page. */
  Documents: monoidMax,
  /** Number of frames in the page. */
  JSEventListeners: monoidMax,
  /** Number of DOM nodes in the page. */
  Nodes: monoidMax,
  /** Total monoidMax of full or partial page layout. */
  LayoutCount: monoidMax,
  /** Total monoidMax of page style recalculations. */
  RecalcStyleCount: monoidMax,
  /** Combined durations of all page layouts. */
  LayoutDuration: monoidMax,
  /** Combined duration of all page style recalculations. */
  RecalcStyleDuration: monoidMax,
  /** Combined duration of JavaScript execution. */
  ScriptDuration: monoidMax,
  /** Combined duration of all tasks performed by the browser. */
  TaskDuration: monoidMax,
  /** Used JavaScript heap size. */
  JSHeapUsedSize: monoidMax,
  /** Total JavaScript heap size. */
  JSHeapTotalSize: monoidMax,
});

const fpsResponse = D.type({
  fps: D.number,
});
export const decodeFpsResponse = fpsResponse.decode;
