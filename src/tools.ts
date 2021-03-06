import { srestS3KeyToURLStr } from "./util";
import { pipe } from "fp-ts/function";
import { either, reader, taskEither } from "fp-ts";
import { decodeSRestTestDataSetInput } from "./types/Srest";

/**
 * Create testable SRest that is available for 30 minutes.
 * @param jsonStr
 * @param styleID
 */
export function makeTestableSRestFromDataSetJSON(
  jsonStr: string,
  styleID: string
) {
  return pipe(
    srestS3KeyToURLStr,
    reader.map((srestReader) => {
      return pipe(
        decodeSRestTestDataSetInput(JSON.parse(jsonStr)),
        either.map((srestTestData) => srestTestData[styleID].srest),
        either.map(srestReader),
        either.sequence(taskEither.taskEither),
        taskEither.chainEitherKW((x) => x)
      );
    })
  );
}
