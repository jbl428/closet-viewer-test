import { pipe } from "fp-ts/function";
import fs from "fs";
import { decodeAnswerDataSet } from "../src/types/AnswerData";
import { array, either, record } from "fp-ts";
import { Facets } from "../src/Facets";
import { S3Key } from "../src/types/types";

export function makeBadAnswer(
  answerJsonPath: string,
  badAnswerJsonPath: string
) {
  return pipe(
    fs.readFileSync(answerJsonPath, "utf-8"),
    JSON.parse,
    decodeAnswerDataSet,
    either.map(
      record.map(
        record.map(
          array.map(
            (xx: Facets<S3Key[]>): Facets<S3Key[]> => ({
              back: xx.bottom,
              bottom: xx.back,
              front: xx.left,
              left: xx.front,
              right: xx.left,
              top: xx.bottom,
            })
          )
        )
      )
    ),
    either.map((badAnswer) => {
      fs.writeFileSync(badAnswerJsonPath, JSON.stringify(badAnswer));
    })
  );
}
