/// <reference types="react" />
/// <reference types="node" />
import { Browser } from "puppeteer";
import * as E from "fp-ts/Either";
import { ReaderTaskEither } from "fp-ts/ReaderTaskEither";
import { URL } from "url";
import { ReaderObservableEither } from "fp-ts-rxjs/lib/ReaderObservableEither";
export declare function streamScreenshots_browser(jsx: JSX.Element, hookDomain: string): ReaderObservableEither<Browser, unknown, Buffer>;
export declare function generateAndSaveSrestAnswers(srestURLs: string[], destination: string, libURL: URL): import("fp-ts/lib/TaskEither").TaskEither<void, void>;
export declare function generateAndSaveZrestAnswers(libURL: URL, zrestURLs: URL[], destination: string): import("fp-ts/lib/TaskEither").TaskEither<void, void>;
export declare function runWithBrowser<_E, _T>(browserReadingTask: ReaderTaskEither<Browser, _E, _T>): import("fp-ts/lib/TaskEither").TaskEither<void, _T>;
export declare function saveDebugImages(x: Buffer, y: Buffer, index: number, destination: string): E.Left<string> | E.Right<number>;
export declare function lexicographic(idx: number): string;
export declare function testSrestLibrary(libURL: URL, srestURLs: string[], answersDir: string, debugImageDir: string): import("fp-ts/lib/TaskEither").TaskEither<void, number>;
export declare function testZrestLibrary(libURL: URL, zrestURLs: URL[], answersDir: string, debugImageDir: string): import("fp-ts/lib/TaskEither").TaskEither<void, number>;
