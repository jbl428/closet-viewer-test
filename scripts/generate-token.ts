#!/usr/bin/env npx ts-node
import fetch from "node-fetch";
import { tryCatchK } from "fp-ts/TaskEither";
import {
  CommandLineParser,
  CommandLineStringParameter,
} from "@rushstack/ts-command-line";
import { pipe } from "fp-ts/function";
import { taskEither } from "fp-ts";
import { addSlash } from "../src/types";

type Account = {
  domain: string;
  email: string;
  password: string;
};

function getToken({ domain, email, password }: Account) {
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

class CLI extends CommandLineParser {
  domain: CommandLineStringParameter;
  email: CommandLineStringParameter;
  password: CommandLineStringParameter;

  protected onDefineParameters(): void {}

  protected onExecute(): Promise<void> {
    const t = getToken({
      domain: this.domain.value!,
      email: this.email.value!,
      password: this.password.value!,
    });
    pipe(
      t,
      taskEither.bimap(console.error, (x) => console.log("TOKEN is\n" + x))
    )();
    return super.onExecute();
  }

  constructor() {
    super({
      toolDescription: "Generate Token",
      toolFilename: "generate-token.ts",
    });
    this.domain = this.defineStringParameter({
      argumentName: "DOMAIN",
      description: "Domain CLO-SET service",
      parameterLongName: "--domain",
      required: true,
    });
    this.email = this.defineStringParameter({
      argumentName: "EMAIL",
      description: "User email",
      parameterLongName: "--email",
      required: true,
    });
    this.password = this.defineStringParameter({
      argumentName: "PASSWORD",
      description: "Password",
      parameterLongName: "--password",
      required: true,
    });
  }
}

new CLI().execute().catch(console.error);
