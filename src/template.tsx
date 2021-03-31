import React from "react";
import * as U from "url";
import { URL } from "url";
import { SRest } from "./types/Srest";

export const hookDomain = "http://screenshotrequest.clo";
export type StreamTemplate<A> = (
  libURL: URL
) => (data: readonly A[]) => JSX.Element;
export const templateZrest: StreamTemplate<URL> = (libURL) => (zrestURLs) => (
  <div>
    <div id="target" style={{ width: 512, height: 512 }} />
    <script type="text/javascript" src={libURL.toString()} />
    <script
      dangerouslySetInnerHTML={{
        __html: `
closet.viewer.init({
  element: "target",
  width: 512,
  height: 512,
  stats: true,
});
${makeRecursiveZrestTemplateJSCode(zrestURLs.map((x) => x.toString()))}
    `,
      }}
    />
  </div>
);

function makeRecursiveZrestTemplateJSCode(
  zrestURLs: readonly string[]
): string {
  if (zrestURLs.length === 0) {
    return `fetch("${hookDomain}", { method: "DELETE", });`;
  } else {
    return `
        console.log("ZREST TEST START", "${zrestURLs[0]}")
        closet.viewer.loadZrestWithoutRendering("${zrestURLs[0]}")
          .then(()=>new Promise(done => setTimeout(done, 1000)))
          .then(()=>closet.viewer.capturePrincipleViews())
          .then((images)=>fetch("${hookDomain}", {
              method: "POST",
              body: JSON.stringify({ images, }),
            }))
          .then(()=>{
            ${makeRecursiveZrestTemplateJSCode(zrestURLs.slice(1))}
          })`;
  }
}

function makeRecursiveTemplateJSCode(
  srestObjs: readonly SRest<string>[]
): string {
  if (srestObjs.length === 0) {
    return `fetch("${hookDomain}", { method: "DELETE", });`;
  } else {
    return `
        console.log("SREST TEST START", "${srestObjs[0].rest}")
        closet.viewer.loadSrestWithoutRendering(${JSON.stringify(srestObjs[0])})
          .then(()=>closet.viewer.capturePrincipleViews())
          .then((images)=>fetch("${hookDomain}", {
              method: "POST",
              body: JSON.stringify({ images, }),
            }))
          .then(()=>{
            ${makeRecursiveTemplateJSCode(srestObjs.slice(1))}
          })`;
  }
}

function makeTemplateJSCode(srestObjs: readonly SRest<string>[]): string {
  const initCode = `closet.viewer.init({
  element: "target",
  width: 512,
  height: 512,
  stats: true,
});`;
  return initCode + makeRecursiveTemplateJSCode(srestObjs);
}

export type SRestTemplateConfig = {
  libURL: U.URL;
  srestObjs: readonly SRest<string>[];
};
export const templateSrest: StreamTemplate<SRest<string>> = (libURL) => (
  srestObjs
) => (
  <div>
    <div id="target" style={{ width: 512, height: 512 }} />
    <script type="text/javascript" src={libURL.toString()} />
    <script
      dangerouslySetInnerHTML={{ __html: makeTemplateJSCode(srestObjs) }}
    />
  </div>
);
