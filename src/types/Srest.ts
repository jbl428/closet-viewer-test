import * as D from "io-ts/Decoder";
import { pipe } from "fp-ts/function";
import { S3Key_D } from "./types";
import { readonlyArray, record } from "fp-ts";
import { HKT, Kind2, URIS2 } from "fp-ts/HKT";
import { Applicative, Applicative2 } from "fp-ts/Applicative";

function SRest_D<T>(
  elementDecoder: D.Decoder<unknown, T>
): D.Decoder<unknown, { dracos: T[]; images: T[]; rest: T[] }> {
  return D.struct({
    dracos: D.array(elementDecoder),
    images: D.array(elementDecoder),
    rest: D.array(elementDecoder),
  });
}

export const SRest_D_Str = SRest_D(D.string);
export const SRest_D_S3Key = SRest_D(S3Key_D);

type SRestKey = keyof D.TypeOf<typeof SRest_D_Str>;

export type SRest<A> = Record<SRestKey, readonly A[]>;

export const mapSrest = <A, B>(f: (a: A) => B) => (srest: SRest<A>): SRest<B> =>
  pipe(srest, record.map(readonlyArray.map(f)));

export function sequenceSrest<F extends URIS2>(
  F: Applicative2<F>
): <E, A>(ta: SRest<Kind2<F, E, A>>) => Kind2<F, E, SRest<A>>;
export function sequenceSrest<F>(Fi: Applicative<F>) {
  //Fi for F instance like Monoid instance
  return <A>(ta: SRest<HKT<F, A>>): HKT<F, SRest<A>> => {
    return pipe(
      ta,
      record.map(readonlyArray.sequence(Fi)),
      record.sequence(Fi)
    );
  };
}

const SRestPart = D.struct({
  srest: SRest_D_S3Key,
});
export type SRestPart = D.TypeOf<typeof SRestPart>;
const SRestTestDataSetInput = D.record(SRestPart);
export type SRestTestDataSetInput = D.TypeOf<typeof SRestTestDataSetInput>;
export const decodeSRestTestDataSetInput = SRestTestDataSetInput.decode;
const SRestResponse = D.type({
  isSeparated: D.boolean,
  result: SRest_D_Str,
});
export const decodeSRestResponse = SRestResponse.decode;
