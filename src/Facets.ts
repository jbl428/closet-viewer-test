// Identity.ts

import { Apply1 } from "fp-ts/Apply";
import { pipe } from "fp-ts/function";
import { record } from "fp-ts";

export type Facets<A> = {
  front: A;
  top: A;
  back: A;
  bottom: A;
  right: A;
  left: A;
};
export const FacetKeyOrder: (keyof Facets<unknown>)[] = [
  "front",
  "top",
  "back",
  "bottom",
  "right",
  "left",
];

export function facetFromArray<A>(arr: readonly A[]): Facets<A> {
  return {
    front: arr[0],
    top: arr[1],
    back: arr[2],
    bottom: arr[3],
    right: arr[4],
    left: arr[5],
  };
}

export const URI = "Facets";

export type URI = typeof URI;

declare module "fp-ts/lib/HKT" {
  interface URItoKind<A> {
    readonly Facets: Facets<A>;
  }
}

// Functor instance
export const applyFacets: Apply1<URI> = {
  URI,
  map(ma, f) {
    return pipe(ma, record.map(f));
  },
  ap(fab, fa) {
    return pipe(
      fa,
      record.mapWithIndex((k, v) => {
        return fab[k](v);
      })
    );
  },
};
