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

export function tup<A, B>(a: A, b: B): [A, B] {
  return [a, b];
}

export function tup3<A, B, C>(a: A, b: B, c: C): [A, B, C] {
  return [a, b, c];
}

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
