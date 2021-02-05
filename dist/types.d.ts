import * as D from "io-ts/Decoder";
export declare const D_SRest: D.Decoder<unknown, {
    dracos: string[];
    images: string[];
    rest: string[];
}>;
export declare type SRest = D.TypeOf<typeof D_SRest>;
