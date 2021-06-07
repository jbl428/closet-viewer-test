import { fetchSrest_styleid, writeOutputsToS3 } from "./write";
import * as D from "io-ts/Decoder";
import * as fs from "fs";
import { pipe } from "fp-ts/function";
import { taskEither } from "fp-ts";
import { getClosetToken } from "./index";
import { S3Client } from "@aws-sdk/client-s3";
import * as template from "./texture-quality-template";
import { URL } from "url";
import { tup } from "./types/types";
import { testDataSet } from "./functions";
import { sequenceT } from "fp-ts/Apply";
import { AnswerData } from "./types/AnswerData";

const Input = D.struct({
  domain: D.string,
  styleID: D.string,
});
type Input = D.TypeOf<typeof Input>;
type Config = {
  s3: S3Client;
  bucket: string;
  baseS3Key: string;
  libURL: URL;
  email: string;
  password: string;
};
const _fetchSrestAndMakeJSX = (
  libURL: URL,
  email: string,
  password: string
) => (input: Input) => {
  const token = getClosetToken({ email, password, ...input });
  return pipe(
    token,
    taskEither.chain((token) =>
      fetchSrest_styleid(input.domain, token)(input.styleID)
    ),
    taskEither.map((srest) => {
      return template.template(libURL, [srest]);
    })
  );
};
const Answer = D.struct({
  bucket: D.string,
  baseS3Key: D.string,
  styleID: D.string,
  answer: AnswerData,
});

const _generateAnswer = (config: Config) => (input: Input) => {
  const { s3, bucket, baseS3Key } = config;

  const jsx = _fetchSrestAndMakeJSX(
    config.libURL,
    config.email,
    config.password
  )(input);

  const images = pipe(
    jsx,
    taskEither.chain((jsx) => {
      return writeOutputsToS3(s3, bucket, baseS3Key, [tup(input.styleID, jsx)]);
    })
  );

  return pipe(
    images,
    taskEither.map((images) => {
      const [styleID, answer] = images[0];
      return {
        bucket,
        baseS3Key,
        styleID,
        answer,
      };
    })
  );
};

export function generateAnswer(
  config: Config,
  inputJsonPath: string,
  outputJsonPath: string
) {
  const obj = JSON.parse(fs.readFileSync(inputJsonPath, "utf-8"));
  return pipe(
    obj,
    Input.decode,
    taskEither.fromEither,
    taskEither.chain(_generateAnswer(config)),
    taskEither.map((jsonObj) => {
      fs.writeFileSync(outputJsonPath, JSON.stringify(jsonObj, undefined, 2));
    })
  );
}

export function test(
  config: {
    s3: S3Client;
    libURL: URL;
    email: string;
    password: string;
  },
  inputJsonPath: string,
  debugImageDir: string,
  answerJsonPath: string
) {
  const srestJSX = pipe(
    JSON.parse(fs.readFileSync(inputJsonPath, "utf-8")),
    Input.decode,
    taskEither.fromEither,
    taskEither.chain(
      _fetchSrestAndMakeJSX(config.libURL, config.email, config.password)
    )
  );

  const answers = pipe(
    JSON.parse(fs.readFileSync(answerJsonPath, "utf-8")),
    Answer.decode,
    taskEither.fromEither,
    taskEither.mapLeft((x) => x as any)
  );
  const seqTE = sequenceT(taskEither.ApplicativeSeq);
  return pipe(
    seqTE(srestJSX, answers),
    taskEither.chain(([jsx, { bucket, baseS3Key, answer, styleID }]) => {
      return testDataSet(
        [
          {
            answer,
            styleID: "",
          },
        ],
        bucket,
        config.s3,
        debugImageDir,
        jsx
      );
    })
  );
}
