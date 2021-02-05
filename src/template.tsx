import React from "react";
import * as U from "url";

export const hookDomain = "http://screenshotrequest.clo";


export const templateZrest = (libURL: U.URL, zrestURLs: U.URL[]) => (
    <div>
        <div id="target" style={{width: 512, height: 512}}/>
        <script type='text/javascript' src={libURL.toString()}/>
        <script dangerouslySetInnerHTML={{
            __html: `
closet.viewer.init({
  element: "target",
  width: 512,
  height: 512,
  stats: true,
});
${makeRecursiveZrestTemplateJSCode(zrestURLs.map(x => x.toString()))}
    `
        }}>
        </script>
    </div>
);

function makeRecursiveZrestTemplateJSCode(zrestURLs: readonly string[]): string {
    if (zrestURLs.length === 0) {
        return `fetch("${hookDomain}", { method: "DELETE", });`
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
          })`
    }
}

function makeRecursiveTemplateJSCode(srestURLs: readonly string[]): string {
    if (srestURLs.length === 0) {
        return `fetch("${hookDomain}", { method: "DELETE", });`
    } else {
        return `
        console.log("SREST TEST START", "${srestURLs[0]}")
        closet.viewer.loadSrestWithoutRendering("${srestURLs[0]}")
          .then(()=>closet.viewer.capturePrincipleViews())
          .then((images)=>fetch("${hookDomain}", {
              method: "POST",
              body: JSON.stringify({ images, }),
            }))
          .then(()=>{
            ${makeRecursiveTemplateJSCode(srestURLs.slice(1))}
          })`
    }
}

function makeTemplateJSCode(srestURLs: readonly string[]): string {
    const initCode = `closet.viewer.init({
  element: "target",
  width: 512,
  height: 512,
  stats: true,
});`;
    return initCode + makeRecursiveTemplateJSCode(srestURLs);
}

export type SRestTemplateConfig = {
    libURL: U.URL;
    srestURLs: readonly string[];
}
export const templateSrest = ({libURL, srestURLs}:SRestTemplateConfig) => (
    <div>
        <div id="target" style={{width: 512, height: 512}}/>
        <script type='text/javascript' src={libURL.toString()}/>
        <script dangerouslySetInnerHTML={{__html: makeTemplateJSCode(srestURLs)}}>
        </script>
    </div>
);
