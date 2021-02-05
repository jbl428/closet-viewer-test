/// <reference types="react" />
/// <reference types="node" />
import * as U from "url";
export declare const hookDomain = "http://screenshotrequest.clo";
export declare const templateZrest: (libURL: U.URL, zrestURLs: U.URL[]) => JSX.Element;
export declare type SRestTemplateConfig = {
    libURL: U.URL;
    srestURLs: readonly string[];
};
export declare const templateSrest: ({ libURL, srestURLs }: SRestTemplateConfig) => JSX.Element;
