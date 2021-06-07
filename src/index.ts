import { addSlash } from "./types/types";
import fetch from "node-fetch";
import { tryCatchK } from "fp-ts/TaskEither";

export { writeOutputsToS3 } from "./write";

type Account = {
  domain: string;
  email: string;
  password: string;
};

export function getClosetToken({ domain, email, password }: Account) {
  const safeEmail = encodeURIComponent(email);
  const safePass = encodeURIComponent(password);
  const url =
    addSlash(domain) +
    "api/auth/token?email=" +
    safeEmail +
    "&password=" +
    safePass;
  const getter = () =>
    fetch(url, {
      headers: {
        "api-version": "2.0",
      },
    }).then((x) => x.text());
  return tryCatchK(getter, (err) => {
    console.error("Getting Token failed", err);
    return new Error("Getting Token failed");
  })();
}

export { fetchSrest_styleid } from "./write";
import * as zrest from "./zrest";
import * as srest from "./srest";
import * as textureQuality from "./texture-quality";
export { zrest, srest, textureQuality };
