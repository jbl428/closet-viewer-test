import * as D from "io-ts/Decoder";
import { S3Key_D } from "./types";

const ZRestPart = D.type({
  key: S3Key_D,
});
export type ZRestPart = D.TypeOf<typeof ZRestPart>;
const ZRestTestData = ZRestPart;
export type ZRestTestData = D.TypeOf<typeof ZRestTestData>;
const ZRestTestDataSet = D.record(ZRestTestData);
export type ZRestTestDataSet = D.TypeOf<typeof ZRestTestDataSet>;
export const decodeZRestTestDataSet = ZRestTestDataSet.decode;
