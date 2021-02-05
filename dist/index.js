"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testZrestLibrary = exports.testSrestLibrary = exports.lexicographic = exports.saveDebugImages = exports.runWithBrowser = exports.generateAndSaveZrestAnswers = exports.generateAndSaveSrestAnswers = exports.streamScreenshots_browser = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const page_request_emitter_1 = require("page-request-emitter");
const E = __importStar(require("fp-ts/Either"));
const Either_1 = require("fp-ts/Either");
const A = __importStar(require("fp-ts/Array"));
const D = __importStar(require("io-ts/Decoder"));
const operators_1 = require("rxjs/operators");
const function_1 = require("fp-ts/function");
const rxjs_1 = require("rxjs");
const TaskEither_1 = require("fp-ts/TaskEither");
const RTE = __importStar(require("fp-ts/ReaderTaskEither"));
const fp_ts_rxjs_1 = require("fp-ts-rxjs");
const fs_1 = __importDefault(require("fs"));
const path_1 = require("path");
const template_1 = require("./template");
const child_process_1 = require("child_process");
const ObservableEither_1 = require("fp-ts-rxjs/lib/ObservableEither");
const Tup = __importStar(require("fp-ts/Tuple"));
const fp_ts_1 = require("fp-ts");
const Option_1 = require("fp-ts/Option");
const NonEmptyArray_1 = require("fp-ts/NonEmptyArray");
const Semigroup_1 = require("fp-ts/Semigroup");
const base64ToBuffer = (encoding) => Buffer.from(encoding, 'base64');
const cutDataURLHead = (dataURL) => {
    const header = "data:image/png;base64,";
    return dataURL.substring(header.length);
};
const principleViewResponse = D.type({
    images: D.array(D.string),
});
function stopWhenError(oe) {
    return new rxjs_1.Observable(subscriber => {
        oe.subscribe({
            next(either) {
                if (!subscriber.closed) {
                    subscriber.next(either);
                    if (Either_1.isLeft(either)) {
                        subscriber.complete();
                    }
                }
            },
            complete() {
                subscriber.complete();
            },
            error(err) {
                subscriber.error(err);
            }
        });
    });
}
function streamScreenshots_browser(jsx, hookDomain) {
    const pageurl = page_request_emitter_1.createTmpHTMLURL_JSX(jsx);
    return function_1.pipe(page_request_emitter_1.createNewPage(), fp_ts_1.reader.map(ObservableEither_1.fromTaskEither), fp_ts_1.reader.map(ob => {
        return function_1.pipe(ob, fp_ts_rxjs_1.observableEither.chain(page => {
            const events = page_request_emitter_1.streamPageEvents(page, pageurl)({
                filter: r => r.url().startsWith(hookDomain),
                alterResponse: () => Option_1.none,
                debugResponse: () => {
                }
            });
            return stopWhenError(events);
        }), fp_ts_rxjs_1.observableEither.mapLeft(x => x), fp_ts_rxjs_1.observableEither.chain((xxx) => {
            switch (xxx._tag) {
                case "RequestIntercept":
                    const principleViewBuffers = function_1.pipe(xxx.request.postData(), D.string.decode, E.map(JSON.parse), E.chain(principleViewResponse.decode), E.map(x => x.images.map(cutDataURLHead).map(base64ToBuffer)), E.mapLeft(x => x), E.sequence(A.array));
                    return rxjs_1.from(principleViewBuffers);
                case "Log":
                    console.log("Log from page", xxx.message);
                    return rxjs_1.from([]);
            }
        }));
    }));
}
exports.streamScreenshots_browser = streamScreenshots_browser;
const streamSrestScreenshots_browser = function_1.pipe(template_1.templateSrest, fp_ts_1.reader.map(jsx => streamScreenshots_browser(jsx, template_1.hookDomain)));
function mkNewDir(path) {
    if (fs_1.default.existsSync(path)) {
        fs_1.default.rmdirSync(path, { recursive: true });
    }
    fs_1.default.mkdirSync(path);
}
function writeBuffersInLexicographicOrder(destination, buffers) {
    const writeTask = buffers.pipe(operators_1.reduce((acc, value, index) => {
        // return acc;
        const filepath = path_1.resolve(destination, lexicographic(index) + ".png");
        return function_1.pipe(acc, E.chainW(_ => value), E.map(buffer => fs_1.default.writeFileSync(filepath, buffer)));
    }, E.right(mkNewDir(destination))));
    return ObservableEither_1.toTaskEither(writeTask);
}
function generateAndSaveSrestAnswers(srestURLs, destination, libURL) {
    return runWithBrowser(browser => {
        const answerBufferOE = streamSrestScreenshots_browser({ srestURLs, libURL })(browser);
        return writeBuffersInLexicographicOrder(destination, answerBufferOE);
    });
}
exports.generateAndSaveSrestAnswers = generateAndSaveSrestAnswers;
function generateAndSaveZrestAnswers(libURL, zrestURLs, destination) {
    return runWithBrowser(browser => {
        const zrestResults = streamScreenshots_browser(template_1.templateZrest(libURL, zrestURLs), template_1.hookDomain)(browser);
        return writeBuffersInLexicographicOrder(destination, zrestResults);
    });
}
exports.generateAndSaveZrestAnswers = generateAndSaveZrestAnswers;
function runWithBrowser(browserReadingTask) {
    return TaskEither_1.bracket(TaskEither_1.tryCatchK(puppeteer_1.default.launch.bind(puppeteer_1.default), console.error)({ args: ["--no-sandbox", "--disable-web-security"] }), RTE.mapLeft(console.error)(browserReadingTask), (browser) => {
        console.log("Releasing browser ...");
        return TaskEither_1.tryCatchK(() => browser.close(), console.error)();
    });
}
exports.runWithBrowser = runWithBrowser;
function answerStream(answersDir) {
    const answerPaths = fs_1.default.readdirSync(answersDir).filter(x => x.endsWith(".png")).map(x => path_1.resolve(answersDir, x));
    return rxjs_1.from(answerPaths).pipe(operators_1.concatMap((x) => {
        const representative = fs_1.default.readFileSync(x);
        const alternativeAnswersDir = path_1.resolve(answersDir, path_1.basename(x, ".png"));
        if (fs_1.default.existsSync(alternativeAnswersDir)) {
            console.log("Found alternative", alternativeAnswersDir);
            return answerStream(alternativeAnswersDir).pipe(operators_1.map(alternatives => NonEmptyArray_1.cons(representative, alternatives)));
        }
        else {
            return rxjs_1.of(NonEmptyArray_1.cons(representative, []));
        }
    }));
}
function decodePossibleBuffer(x) {
    return function_1.pipe(x, D.string.decode, fp_ts_1.either.getOrElse(_ => {
        if (x instanceof Buffer) {
            return x.toString('utf8');
        }
        else {
            console.log(x);
            return "Failed to decode: neither string or Buffer";
        }
    }));
}
function saveDebugImages(x, y, index, destination) {
    const lexi = lexicographic(index);
    const xpath = path_1.resolve(destination, lexi + "-x.png");
    const ypath = path_1.resolve(destination, lexi + "-y.png");
    fs_1.default.writeFileSync(xpath, x);
    fs_1.default.writeFileSync(ypath, y);
    const spawned = child_process_1.spawnSync("closet-viewer-cv", [
        "-x", xpath,
        "-y", ypath,
        "--diff", path_1.resolve(destination, lexi + "-diff.png"),
        "--highlight", path_1.resolve(destination, lexi + "-highlight.png"),
        "--combined", path_1.resolve(destination, lexi + "-combined.png")
    ]);
    console.log({ stdout: decodePossibleBuffer(spawned.stdout), stderr: decodePossibleBuffer(spawned.stderr) });
    if (spawned.signal) {
        return E.left("closet-viewer-cv killed due to signal:" + spawned.signal);
    }
    else if (spawned.status) {
        return E.left(`closet-viewer-cv exited with error: ${spawned.status}`);
    }
    else {
        return E.right(1);
    }
}
exports.saveDebugImages = saveDebugImages;
function isDifferent([a, b]) {
    return a.compare(b) !== 0;
}
function lexicographic(idx) {
    return "00000000".substr(0, 8 - idx.toString().length) + idx.toString();
}
exports.lexicographic = lexicographic;
function reduceTestResult(resultDebugImagesDir, pairs) {
    mkNewDir(resultDebugImagesDir);
    return pairs.pipe(operators_1.reduce((acc, value, index) => {
        return function_1.pipe(acc, E.chain(failCount => {
            return function_1.pipe(value, E.chainW(([input, answerSet]) => {
                const different = function_1.pipe(answerSet, fp_ts_1.nonEmptyArray.map(answer => isDifferent([input, answer])), fp_ts_1.nonEmptyArray.fold(Semigroup_1.semigroupAll));
                const representative = NonEmptyArray_1.head(answerSet);
                if (different) {
                    const saveSuccess = saveDebugImages(input, representative, index, resultDebugImagesDir);
                    return E.map(_ => failCount + 1)(saveSuccess);
                }
                else {
                    return E.right(failCount);
                }
            }));
        }));
    }, E.right(0)));
}
function compareResultsAndAnswers(resultEs, answersDir, debugImageDir) {
    const answers = answerStream(answersDir);
    const testResult = rxjs_1.zip(resultEs, answers).pipe(operators_1.map(Tup.sequence(E.either)), pairsOb => reduceTestResult(debugImageDir, pairsOb));
    return ObservableEither_1.toTaskEither(testResult);
}
function testSrestLibrary(libURL, srestURLs, answersDir, debugImageDir) {
    return runWithBrowser(browser => {
        return compareResultsAndAnswers(streamSrestScreenshots_browser({ srestURLs, libURL })(browser), answersDir, debugImageDir);
    });
}
exports.testSrestLibrary = testSrestLibrary;
function testZrestLibrary(libURL, zrestURLs, answersDir, debugImageDir) {
    return runWithBrowser(browser => {
        return compareResultsAndAnswers(streamScreenshots_browser(template_1.templateZrest(libURL, zrestURLs), template_1.hookDomain)(browser), answersDir, debugImageDir);
    });
}
exports.testZrestLibrary = testZrestLibrary;
