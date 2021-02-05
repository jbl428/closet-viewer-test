"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateSrest = exports.templateZrest = exports.hookDomain = void 0;
const react_1 = __importDefault(require("react"));
exports.hookDomain = "http://screenshotrequest.clo";
const templateZrest = (libURL, zrestURLs) => (react_1.default.createElement("div", null,
    react_1.default.createElement("div", { id: "target", style: { width: 512, height: 512 } }),
    react_1.default.createElement("script", { type: 'text/javascript', src: libURL.toString() }),
    react_1.default.createElement("script", { dangerouslySetInnerHTML: {
            __html: `
closet.viewer.init({
  element: "target",
  width: 512,
  height: 512,
  stats: true,
});
${makeRecursiveZrestTemplateJSCode(zrestURLs.map(x => x.toString()))}
    `
        } })));
exports.templateZrest = templateZrest;
function makeRecursiveZrestTemplateJSCode(zrestURLs) {
    if (zrestURLs.length === 0) {
        return `fetch("${exports.hookDomain}", { method: "DELETE", });`;
    }
    else {
        return `
        console.log("ZREST TEST START", "${zrestURLs[0]}")
        closet.viewer.loadZrestWithoutRendering("${zrestURLs[0]}")
          .then(()=>closet.viewer.capturePrincipleViews())
          .then((images)=>fetch("${exports.hookDomain}", {
              method: "POST",
              body: JSON.stringify({ images, }),
            }))
          .then(()=>{
            ${makeRecursiveZrestTemplateJSCode(zrestURLs.slice(1))}
          })`;
    }
}
function makeRecursiveTemplateJSCode(srestURLs) {
    if (srestURLs.length === 0) {
        return `fetch("${exports.hookDomain}", { method: "DELETE", });`;
    }
    else {
        return `
        console.log("SREST TEST START", "${srestURLs[0]}")
        closet.viewer.loadSrestWithoutRendering("${srestURLs[0]}")
          .then(()=>closet.viewer.capturePrincipleViews())
          .then((images)=>fetch("${exports.hookDomain}", {
              method: "POST",
              body: JSON.stringify({ images, }),
            }))
          .then(()=>{
            ${makeRecursiveTemplateJSCode(srestURLs.slice(1))}
          })`;
    }
}
function makeTemplateJSCode(srestURLs) {
    const initCode = `closet.viewer.init({
  element: "target",
  width: 512,
  height: 512,
  stats: true,
});`;
    return initCode + makeRecursiveTemplateJSCode(srestURLs);
}
const templateSrest = ({ libURL, srestURLs }) => (react_1.default.createElement("div", null,
    react_1.default.createElement("div", { id: "target", style: { width: 512, height: 512 } }),
    react_1.default.createElement("script", { type: 'text/javascript', src: libURL.toString() }),
    react_1.default.createElement("script", { dangerouslySetInnerHTML: { __html: makeTemplateJSCode(srestURLs) } })));
exports.templateSrest = templateSrest;
