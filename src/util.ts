import fetch from "node-fetch";
import { reader } from "fp-ts";
import { taskEitherSeq, tryCatchK } from "fp-ts/TaskEither";
import { identity, pipe } from "fp-ts/function";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Key } from "./types/types";
import { URL } from "url";
import { mapSrest, sequenceSrest, SRest } from "./types/Srest";

const _downloadBufferFromS3 = (
  config: { Bucket: string; Key: string },
  s3Client: S3Client
) =>
  s3Client.send(new GetObjectCommand(config)).then(async (xx) => {
    const b = xx.Body;
    if (b instanceof Readable) {
      let data = [];
      for await (const chunk of b) {
        data.push(chunk);
      }
      return Buffer.concat(data);
    } else {
      throw config.Key + " is not Readable" + typeof b;
    }
  });
export const downloadBufferFromS3 = tryCatchK(_downloadBufferFromS3, identity);

function _key2URL(Key: string, Bucket: string, s3: S3Client) {
  // console.debug(Key, Bucket);
  return getSignedUrl(s3 as any, new GetObjectCommand({ Key, Bucket }) as any, {
    signingRegion: "ap-northeast-2",
    expiresIn: 60 * 30, // 30 minutes
  });
}

export const key2URL = tryCatchK(_key2URL, (err) => {
  console.error("Failed to create presigned url", err);
  return err;
});
type UploadType =
  | { _tag: "string"; text: string }
  | { _tag: "buffer"; buffer: Buffer };

export function uploads3(s3: S3Client, key: string, bucket: string) {
  console.log("Uploading", key);
  const map2cmd = (payload: UploadType): PutObjectCommand => {
    switch (payload._tag) {
      case "string":
        return new PutObjectCommand({
          Body: payload.text,
          Bucket: bucket,
          // GrantRead: 'uri="http://acs.amazonaws.com/groups/global/AllUsers"',
          Key: key,
        });
      case "buffer":
        return new PutObjectCommand({
          Body: payload.buffer,
          Bucket: bucket,
          ContentLength: payload.buffer.length,
          // GrantRead: 'uri="http://acs.amazonaws.com/groups/global/AllUsers"',
          Key: key,
        });
    }
  };
  const aa = tryCatchK(
    (cmd: PutObjectCommand) => s3.send(cmd),
    (x) => x
  );

  return pipe(map2cmd, reader.map(aa));
}

export const downloadBuffer = tryCatchK(_downloadBuffer, identity);

function _downloadBuffer(url: string) {
  return fetch(url).then((x) => x.buffer());
}

export function srestS3KeyToURLStr({
  Bucket,
  s3,
}: {
  Bucket: string;
  s3: S3Client;
}) {
  return (srest: SRest<S3Key>) => {
    return pipe(
      srest,
      mapSrest((key) => key2URL(key.str, Bucket, s3)),
      sequenceSrest(taskEitherSeq)
    );
  };
}

export function url(str: string) {
  return new URL(str);
}
