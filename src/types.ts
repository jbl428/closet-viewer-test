import * as D from "io-ts/Decoder";
import { pipe } from "fp-ts/function";
import { either } from "fp-ts";

const SRest = D.type({
  dracos: D.array(D.string),
  images: D.array(D.string),
  rest: D.array(D.string),
});

export function tup<A, B>(a: A, b: B): [A, B] {
  return [a, b];
}

export const decodeSRest = SRest.decode;
type SRestKey = keyof D.TypeOf<typeof SRest>;
export type SRest<A> = Record<SRestKey, A>;

export class S3Key {
  constructor(public str: string) {}

  toJSON() {
    return this.str;
  }
}

const S3Key_D: D.Decoder<unknown, S3Key> = {
  decode(o) {
    return pipe(
      D.string.decode(o),
      either.map((x) => new S3Key(x))
    );
  },
};

export function addSlash(str: string): string {
  if (str.endsWith("/")) {
    return str;
  } else {
    return str + "/";
  }
}

const AnswerData = D.type({
  front: D.array(S3Key_D),
  top: D.array(S3Key_D),
  back: D.array(S3Key_D),
  bottom: D.array(S3Key_D),
  right: D.array(S3Key_D),
  left: D.array(S3Key_D),
});
export type AnswerData = D.TypeOf<typeof AnswerData>;
const AnswerPart = D.type({
  answers: AnswerData,
});
const ZRestPart = D.type({
  key: S3Key_D,
});
export type ZRestPart = D.TypeOf<typeof ZRestPart>;
const ZRestTestData = pipe(AnswerPart, D.intersect(ZRestPart));

export type ZRestTestData = D.TypeOf<typeof ZRestTestData>;

const SRestPart = D.type({
  srest: D.type({
    dracos: D.array(S3Key_D),
    images: D.array(S3Key_D),
    rest: D.array(S3Key_D),
  }),
});
export type SRestPart = D.TypeOf<typeof SRestPart>;
const SRestTestData = pipe(AnswerPart, D.intersect(SRestPart));
const SRestTestDataSet = D.record(SRestTestData);
export type SRestTestDataSet = D.TypeOf<typeof SRestTestDataSet>;
export const decodeSRestTestDataSet = SRestTestDataSet.decode;

const ZRestTestDataSet = D.record(ZRestTestData);
export type ZRestTestDataSet = D.TypeOf<typeof ZRestTestDataSet>;
export const decodeZRestTestDataSet = ZRestTestDataSet.decode;

const SRestResponse = D.type({
  isSeparated: D.boolean,
  result: SRest,
});
export const decodeSRestResponse = SRestResponse.decode;
