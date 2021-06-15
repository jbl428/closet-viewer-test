import { SRest } from "./types/Srest";
import { hookDomain } from "./template";
import { URL } from "url";
import React from "react";

function makeRecursiveTemplateJSCode(
  srestObjs: readonly SRest<string>[]
): string {
  if (srestObjs.length === 0) {
    return `fetch("${hookDomain}", { method: "DELETE", });`;
  } else {
    return `
        console.log("SREST TEST START", "${srestObjs[0].rest}")
        closet.viewer.loadSrestWithTextureQualities(${JSON.stringify(
          srestObjs[0]
        )})
          .then((captures)=>fetch("${hookDomain}", {
              method: "POST",
              body: JSON.stringify({ captures, }),
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

export const template = (
  libURL: URL,
  srestObjs: readonly SRest<string>[]
): JSX.Element => (
  <div>
    <div id="target" style={{ width: 512, height: 512 }} />
    <script type="text/javascript" src={libURL.toString()} />
    <script
      dangerouslySetInnerHTML={{ __html: makeTemplateJSCode(srestObjs) }}
    />
  </div>
);
