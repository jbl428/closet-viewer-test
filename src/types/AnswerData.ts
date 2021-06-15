import { pipe } from "fp-ts/function";
import { array, readonlyArray, record } from "fp-ts";
import * as D from "io-ts/Decoder";
import { S3Key, S3Key_D } from "./types";
import { Applicative, Applicative2 } from "fp-ts/Applicative";
import { HKT, Kind2, URIS2 } from "fp-ts/HKT";
import { Facets, mapFacets } from "../Facets";

export const AnswerData = D.array(
  D.struct({
    front: D.array(S3Key_D),
    top: D.array(S3Key_D),
    back: D.array(S3Key_D),
    bottom: D.array(S3Key_D),
    right: D.array(S3Key_D),
    left: D.array(S3Key_D),
  })
);
type AnswerData<A> = Array<Facets<readonly A[]>>;
// export function mapAnswerData<A, B>(f: (a: A) => B) {
//   return (x: AnswerData<A>): AnswerData<B> => {
//     return pipe(x, array.map(mapFacets(readonlyArray.map(f))));
//   };
// }
export type AnswerDataT<A> = AnswerData<A>;
export type AnswerDataS3Key = D.TypeOf<typeof AnswerData>;
export function mapAnswerDataGenericS3KeyToAnswerDataS3Key(
  k: AnswerData<S3Key>
): AnswerDataS3Key {
  return pipe(k, array.map(mapFacets(readonlyArray.toArray)));
}
export const mapAnswerData = <A>(f: (k: S3Key) => A) => (a: AnswerDataS3Key) =>
  pipe(a, array.map(record.map(readonlyArray.map(f))));

export function sequenceAnswerData<F extends URIS2>(
  F: Applicative2<F>
): <E, A>(ta: AnswerData<Kind2<F, E, A>>) => Kind2<F, E, AnswerData<A>>;
export function sequenceAnswerData<F>(Fi: Applicative<F>) {
  //Fi for F instance (like Monoid instance)
  return <A>(ta: AnswerData<HKT<F, A>>): HKT<F, AnswerData<A>> => {
    return pipe(
      ta,
      array.map(record.map(readonlyArray.sequence(Fi))),
      array.map(record.sequence(Fi)),
      array.sequence(Fi)
    );
  };
}

export const AnswerPart = D.struct({
  answers: AnswerData,
});

const AnswerDataSet = D.record(AnswerPart);
export const decodeAnswerDataSet = AnswerDataSet.decode;
export type AnswerDataSet = D.TypeOf<typeof AnswerDataSet>;
