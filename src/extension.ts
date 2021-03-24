import { concatMap, map, toArray } from "rxjs/operators";
import { from, Observable } from "rxjs";
import {
  fromTaskEither,
  left,
  ObservableEither,
} from "fp-ts-rxjs/lib/ObservableEither";
import { pipe } from "fp-ts/function";
import { fold, sequenceArray } from "fp-ts/Either";
import { TaskEither } from "fp-ts/TaskEither";

const chainConcat: <A, B>(
  f: (a: A) => Observable<B>
) => (ma: Observable<A>) => Observable<B> = (f) => (ma) =>
  ma.pipe(concatMap(f));

export const oeChainConcatW = <A, E2, B>(
  f: (a: A) => ObservableEither<E2, B>
) => <E1>(ma: ObservableEither<E1, A>): ObservableEither<E1 | E2, B> =>
  pipe(ma, chainConcat(fold((a) => left<E1 | E2, B>(a), f)));

export const oeChainConcat: <A, E, B>(
  f: (a: A) => ObservableEither<E, B>
) => (ma: ObservableEither<E, A>) => ObservableEither<E, B> = oeChainConcatW;

export const teSequenceArrayConcat = <A, E>(
  tasks: readonly TaskEither<E, A>[]
): TaskEither<E, readonly A[]> => {
  const aaa = from(tasks)
    .pipe(chainConcat(fromTaskEither), toArray(), map(sequenceArray))
    .toPromise();
  return () => aaa;
};
