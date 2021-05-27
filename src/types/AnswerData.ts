import { pipe } from "fp-ts/function";
import { readonlyArray, record } from "fp-ts";
import * as D from "io-ts/Decoder";
import { S3Key, S3Key_D } from "./types";
import { Applicative, Applicative2 } from "fp-ts/Applicative";
import { HKT, Kind2, URIS2 } from "fp-ts/HKT";

export const AnswerData = D.struct({
  front: D.array(S3Key_D),
  top: D.array(S3Key_D),
  back: D.array(S3Key_D),
  bottom: D.array(S3Key_D),
  right: D.array(S3Key_D),
  left: D.array(S3Key_D),
});
type AnswerData<A> = {
  front: readonly A[];
  top: readonly A[];
  back: readonly A[];
  bottom: readonly A[];
  right: readonly A[];
  left: readonly A[];
};
export type AnswerDataS3Key = AnswerData<S3Key>;
export const mapAnswerData = <A>(f: (k: S3Key) => A) => (a: AnswerDataS3Key) =>
  pipe(a, record.map(readonlyArray.map(f)));

export function sequenceAnswerData<F extends URIS2>(
  F: Applicative2<F>
): <E, A>(ta: AnswerData<Kind2<F, E, A>>) => Kind2<F, E, AnswerData<A>>;
export function sequenceAnswerData<F>(Fi: Applicative<F>) {
  //Fi for F instance (like Monoid instance)
  return <A>(ta: AnswerData<HKT<F, A>>): HKT<F, AnswerData<A>> => {
    return pipe(
      ta,
      record.map(readonlyArray.sequence(Fi)),
      record.sequence(Fi)
    );
  };
}

export const AnswerPart = D.type({
  answers: AnswerData,
});