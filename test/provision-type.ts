import * as URL from "url";

export type TestDataProvision = {
    liburl:URL.URL;
    srestURLs:string[];
    zrestURLs: URL.URL[];
}