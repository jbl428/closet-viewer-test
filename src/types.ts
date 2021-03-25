import * as D from "io-ts/Decoder";
import { pipe } from "fp-ts/function";
import { either } from "fp-ts";

export const S3Key_D: D.Decoder<unknown, S3Key> = {
  decode(o) {
    return pipe(
      D.string.decode(o),
      either.map((x) => new S3Key(x))
    );
  },
};

function SRest_D<T>(
  elementDecoder: D.Decoder<unknown, T>
): D.Decoder<unknown, { dracos: T[]; images: T[]; rest: T[] }> {
  return D.type({
    dracos: D.array(elementDecoder),
    images: D.array(elementDecoder),
    rest: D.array(elementDecoder),
  });
}

export const SRest_D_Str = SRest_D(D.string);
export const SRest_D_S3Key = SRest_D(S3Key_D);

export function tup<A, B>(a: A, b: B): [A, B] {
  return [a, b];
}

type SRestKey = keyof D.TypeOf<typeof SRest_D_Str>;
export type SRest<A> = Record<SRestKey, A>;

export class S3Key {
  constructor(public str: string) {}

  toJSON() {
    return this.str;
  }
}

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
  srest: SRest_D_S3Key,
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
  result: SRest_D_Str,
});
export const decodeSRestResponse = SRestResponse.decode;
