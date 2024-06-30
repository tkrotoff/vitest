var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { i as importId, d as rpc, g as getConfig, _ as __vitePreload, b as channel, a as getBrowserState, c as client, l as loadSafeRpc, o as onCancel } from "./rpc-wczK3HEm.js";
function showPopupWarning(name, value, defaultValue) {
  return (...params) => {
    const formatedParams = params.map((p) => JSON.stringify(p)).join(", ");
    console.warn(`Vitest encountered a \`${name}(${formatedParams})\` call that it cannot handle by default, so it returned \`${value}\`. Read more in https://vitest.dev/guide/browser#thread-blocking-dialogs.
If needed, mock the \`${name}\` call manually like:

\`\`\`
import { expect, vi } from "vitest"

vi.spyOn(window, "${name}")${defaultValue ? `.mockReturnValue(${JSON.stringify(defaultValue)})` : ""}
${name}(${formatedParams})
expect(${name}).toHaveBeenCalledWith(${formatedParams})
\`\`\``);
    return value;
  };
}
function setupDialogsSpy() {
  globalThis.alert = showPopupWarning("alert", void 0);
  globalThis.confirm = showPopupWarning("confirm", false, true);
  globalThis.prompt = showPopupWarning("prompt", null, "your value");
}
const { Date: Date$1, console: console$1 } = globalThis;
async function setupConsoleLogSpy() {
  const { stringify, format, inspect } = await importId("vitest/utils");
  const { log, info, error, dir, dirxml, trace, time, timeEnd, timeLog, warn, debug: debug2, count, countReset } = console$1;
  const formatInput = (input) => {
    if (input instanceof Node)
      return stringify(input);
    return format(input);
  };
  const processLog = (args) => args.map(formatInput).join(" ");
  const sendLog = (type, content) => {
    var _a, _b;
    if (content.startsWith("[vite]"))
      return;
    const unknownTestId = "__vitest__unknown_test__";
    const taskId = ((_b = (_a = globalThis.__vitest_worker__) == null ? void 0 : _a.current) == null ? void 0 : _b.id) ?? unknownTestId;
    rpc().sendLog({
      content,
      time: Date$1.now(),
      taskId,
      type,
      size: content.length
    });
  };
  const stdout = (base) => (...args) => {
    sendLog("stdout", processLog(args));
    return base(...args);
  };
  const stderr = (base) => (...args) => {
    sendLog("stderr", processLog(args));
    return base(...args);
  };
  console$1.log = stdout(log);
  console$1.debug = stdout(debug2);
  console$1.info = stdout(info);
  console$1.error = stderr(error);
  console$1.warn = stderr(warn);
  console$1.dir = (item, options) => {
    sendLog("stdout", inspect(item, options));
    return dir(item, options);
  };
  console$1.dirxml = (...args) => {
    sendLog("stdout", processLog(args));
    return dirxml(...args);
  };
  console$1.trace = (...args) => {
    const content = processLog(args);
    const error2 = new Error("Trace");
    const stack = (error2.stack || "").split("\n").slice(2).join("\n");
    sendLog("stdout", `${content}
${stack}`);
    return trace(...args);
  };
  const timeLabels = {};
  console$1.time = (label = "default") => {
    const now = performance.now();
    time(label);
    timeLabels[label] = now;
  };
  console$1.timeLog = (label = "default") => {
    timeLog(label);
    if (!(label in timeLabels))
      sendLog("stderr", `Timer "${label}" does not exist`);
    else
      sendLog("stdout", `${label}: ${timeLabels[label]} ms`);
  };
  console$1.timeEnd = (label = "default") => {
    const end = performance.now();
    timeEnd(label);
    const start = timeLabels[label];
    if (!(label in timeLabels)) {
      sendLog("stderr", `Timer "${label}" does not exist`);
    } else if (start) {
      const duration = end - start;
      sendLog("stdout", `${label}: ${duration} ms`);
    }
  };
  const countLabels = {};
  console$1.count = (label = "default") => {
    const counter = (countLabels[label] ?? 0) + 1;
    countLabels[label] = counter;
    sendLog("stdout", `${label}: ${counter}`);
    return count(label);
  };
  console$1.countReset = (label = "default") => {
    countLabels[label] = 0;
    return countReset(label);
  };
}
class BrowserSnapshotEnvironment {
  getVersion() {
    return "1";
  }
  getHeader() {
    return `// Vitest Snapshot v${this.getVersion()}, https://vitest.dev/guide/snapshot.html`;
  }
  readSnapshotFile(filepath) {
    return rpc().readSnapshotFile(filepath);
  }
  saveSnapshotFile(filepath, snapshot) {
    return rpc().saveSnapshotFile(filepath, snapshot);
  }
  resolvePath(filepath) {
    return rpc().resolveSnapshotPath(filepath);
  }
  resolveRawPath(testPath, rawPath) {
    return rpc().resolveSnapshotRawPath(testPath, rawPath);
  }
  removeSnapshotFile(filepath) {
    return rpc().removeSnapshotFile(filepath);
  }
}
const browserHashMap = /* @__PURE__ */ new Map();
function createBrowserRunner(runnerClass, coverageModule) {
  return class BrowserTestRunner extends runnerClass {
    constructor(options) {
      super(options.config);
      __publicField(this, "config");
      __publicField(this, "hashMap", browserHashMap);
      __publicField(this, "onAfterRunTask", async (task) => {
        var _a, _b, _c;
        await ((_a = super.onAfterRunTask) == null ? void 0 : _a.call(this, task));
        if (this.config.bail && ((_b = task.result) == null ? void 0 : _b.state) === "fail") {
          const previousFailures = await rpc().getCountOfFailedTests();
          const currentFailures = 1 + previousFailures;
          if (currentFailures >= this.config.bail) {
            rpc().onCancel("test-failure");
            (_c = this.onCancel) == null ? void 0 : _c.call(this, "test-failure");
          }
        }
      });
      __publicField(this, "onAfterRunFiles", async (files) => {
        var _a, _b;
        await ((_a = super.onAfterRunFiles) == null ? void 0 : _a.call(this, files));
        const coverage = await ((_b = coverageModule == null ? void 0 : coverageModule.takeCoverage) == null ? void 0 : _b.call(coverageModule));
        if (coverage) {
          await rpc().onAfterSuiteRun({
            coverage,
            transformMode: "web",
            projectName: this.config.name
          });
        }
      });
      __publicField(this, "onCollected", async (files) => {
        if (this.config.includeTaskLocation) {
          try {
            await updateFilesLocations(files);
          } catch (_) {
          }
        }
        return rpc().onCollected(files);
      });
      __publicField(this, "onTaskUpdate", (task) => {
        return rpc().onTaskUpdate(task);
      });
      __publicField(this, "importFile", async (filepath) => {
        let [test, hash] = this.hashMap.get(filepath) ?? [false, ""];
        if (hash === "") {
          hash = Date.now().toString();
          this.hashMap.set(filepath, [false, hash]);
        }
        const base = this.config.base || "/";
        const prefix = `${base}${/^\w:/.test(filepath) ? "@fs/" : ""}`;
        const query = `${test ? "browserv" : "v"}=${hash}`;
        const importpath = `${prefix}${filepath}?${query}`.replace(/\/+/g, "/");
        await __vitePreload(() => import(importpath), true ? __vite__mapDeps([]) : void 0);
      });
      this.config = options.config;
    }
  };
}
let cachedRunner = null;
async function initiateRunner() {
  if (cachedRunner)
    return cachedRunner;
  const config = getConfig();
  const [{ VitestTestRunner }, { takeCoverageInsideWorker, loadDiffConfig, loadSnapshotSerializers }] = await Promise.all([
    importId("vitest/runners"),
    importId("vitest/browser")
  ]);
  const BrowserRunner = createBrowserRunner(VitestTestRunner, {
    takeCoverage: () => takeCoverageInsideWorker(config.coverage, { executeId: importId })
  });
  if (!config.snapshotOptions.snapshotEnvironment)
    config.snapshotOptions.snapshotEnvironment = new BrowserSnapshotEnvironment();
  const runner = new BrowserRunner({
    config
  });
  const executor = { executeId: importId };
  const [diffOptions] = await Promise.all([
    loadDiffConfig(config, executor),
    loadSnapshotSerializers(config, executor)
  ]);
  runner.config.diffOptions = diffOptions;
  cachedRunner = runner;
  return runner;
}
async function updateFilesLocations(files) {
  const { loadSourceMapUtils } = await importId("vitest/utils");
  const { TraceMap, originalPositionFor } = await loadSourceMapUtils();
  const promises = files.map(async (file) => {
    const result = await rpc().getBrowserFileSourceMap(file.filepath);
    if (!result)
      return null;
    const traceMap = new TraceMap(result);
    function updateLocation(task) {
      if (task.location) {
        const { line, column } = originalPositionFor(traceMap, task.location);
        if (line != null && column != null)
          task.location = { line, column: task.each ? column : column + 1 };
      }
      if ("tasks" in task)
        task.tasks.forEach(updateLocation);
    }
    file.tasks.forEach(updateLocation);
    return null;
  });
  await Promise.all(promises);
}
function throwNotImplemented(name) {
  throw new Error(`[vitest] ${name} is not implemented in browser environment yet.`);
}
class VitestBrowserClientMocker {
  importActual() {
    throwNotImplemented("importActual");
  }
  importMock() {
    throwNotImplemented("importMock");
  }
  queueMock() {
    throwNotImplemented("queueMock");
  }
  queueUnmock() {
    throwNotImplemented("queueUnmock");
  }
  prepare() {
  }
}
function on(event, listener) {
  window.addEventListener(event, listener);
  return () => window.removeEventListener(event, listener);
}
function serializeError(unhandledError) {
  return {
    ...unhandledError,
    name: unhandledError.name,
    message: unhandledError.message,
    stack: String(unhandledError.stack)
  };
}
async function defaultErrorReport(type, unhandledError) {
  const error = serializeError(unhandledError);
  channel.postMessage({ type: "error", files: getBrowserState().runningFiles, error, errorType: type });
}
function catchWindowErrors(cb) {
  let userErrorListenerCount = 0;
  function throwUnhandlerError(e) {
    if (userErrorListenerCount === 0 && e.error != null)
      cb(e);
    else
      console.error(e.error);
  }
  const addEventListener = window.addEventListener.bind(window);
  const removeEventListener = window.removeEventListener.bind(window);
  window.addEventListener("error", throwUnhandlerError);
  window.addEventListener = function(...args) {
    if (args[0] === "error")
      userErrorListenerCount++;
    return addEventListener.apply(this, args);
  };
  window.removeEventListener = function(...args) {
    if (args[0] === "error" && userErrorListenerCount)
      userErrorListenerCount--;
    return removeEventListener.apply(this, args);
  };
  return function clearErrorHandlers() {
    window.removeEventListener("error", throwUnhandlerError);
  };
}
function registerUnhandledErrors() {
  const stopErrorHandler2 = catchWindowErrors((e) => defaultErrorReport("Error", e.error));
  const stopRejectionHandler = on("unhandledrejection", (e) => defaultErrorReport("Unhandled Rejection", e.reason));
  return () => {
    stopErrorHandler2();
    stopRejectionHandler();
  };
}
function registerUnexpectedErrors(rpc2) {
  catchWindowErrors((event) => reportUnexpectedError(rpc2, "Error", event.error));
  on("unhandledrejection", (event) => reportUnexpectedError(rpc2, "Unhandled Rejection", event.reason));
}
async function reportUnexpectedError(rpc2, type, error) {
  const { processError } = await importId("vitest/browser");
  const processedError = processError(error);
  await rpc2.onUnhandledError(processedError, type);
}
const stopErrorHandler = registerUnhandledErrors();
const url = new URL(location.href);
const reloadStart = url.searchParams.get("__reloadStart");
function debug(...args) {
  const debug2 = getConfig().env.VITEST_BROWSER_DEBUG;
  if (debug2 && debug2 !== "false")
    client.rpc.debug(...args.map(String));
}
async function tryCall(fn) {
  try {
    return await fn();
  } catch (err) {
    const now = Date.now();
    const canTry = !reloadStart || now - Number(reloadStart) < 3e4;
    debug("failed to resolve runner", err == null ? void 0 : err.message, "trying again:", canTry, "time is", now, "reloadStart is", reloadStart);
    if (!canTry) {
      const error = serializeError(new Error("Vitest failed to load its runner after 30 seconds."));
      error.cause = serializeError(err);
      await client.rpc.onUnhandledError(error, "Preload Error");
      return false;
    }
    if (!reloadStart) {
      const newUrl = new URL(location.href);
      newUrl.searchParams.set("__reloadStart", now.toString());
      debug("set the new url because reload start is not set to", newUrl);
      location.href = newUrl.toString();
    } else {
      debug("reload the iframe because reload start is set", location.href);
      location.reload();
    }
  }
}
async function prepareTestEnvironment(files) {
  debug("trying to resolve runner", `${reloadStart}`);
  const config = getConfig();
  const viteClientPath = `${config.base || "/"}@vite/client`;
  await __vitePreload(() => import(viteClientPath), true ? __vite__mapDeps([]) : void 0);
  const rpc2 = await loadSafeRpc(client);
  stopErrorHandler();
  registerUnexpectedErrors(rpc2);
  const providedContext = await client.rpc.getProvidedContext();
  const state = {
    ctx: {
      pool: "browser",
      worker: "./browser.js",
      workerId: 1,
      config,
      projectName: config.name,
      files,
      environment: {
        name: "browser",
        options: null
      },
      providedContext,
      invalidates: []
    },
    onCancel,
    mockMap: /* @__PURE__ */ new Map(),
    config,
    environment: {
      name: "browser",
      transformMode: "web",
      setup() {
        throw new Error("Not called in the browser");
      }
    },
    moduleCache: getBrowserState().moduleCache,
    rpc: rpc2,
    durations: {
      environment: 0,
      prepare: 0
    },
    providedContext
  };
  globalThis.__vitest_browser__ = true;
  globalThis.__vitest_worker__ = state;
  globalThis.__vitest_mocker__ = new VitestBrowserClientMocker();
  await setupConsoleLogSpy();
  setupDialogsSpy();
  const { startTests, setupCommonEnv } = await importId("vitest/browser");
  const version = url.searchParams.get("browserv") || "0";
  files.forEach((filename) => {
    const currentVersion = browserHashMap.get(filename);
    if (!currentVersion || currentVersion[1] !== version)
      browserHashMap.set(filename, [true, version]);
  });
  const runner = await initiateRunner();
  onCancel.then((reason) => {
    var _a;
    (_a = runner.onCancel) == null ? void 0 : _a.call(runner, reason);
  });
  return {
    runner,
    config,
    state,
    setupCommonEnv,
    startTests
  };
}
function done(files) {
  channel.postMessage({ type: "done", filenames: files });
}
async function runTests(files) {
  await client.waitForConnection();
  debug("client is connected to ws server");
  let preparedData;
  try {
    preparedData = await tryCall(() => prepareTestEnvironment(files));
  } catch (error) {
    debug("data cannot be loaded because it threw an error");
    await client.rpc.onUnhandledError(serializeError(error), "Preload Error");
    done(files);
    return;
  }
  if (preparedData === false) {
    debug("data cannot be loaded, finishing the test");
    done(files);
    return;
  }
  if (!preparedData) {
    debug("page is reloading, waiting for the next run");
    return;
  }
  debug("runner resolved successfully");
  const { config, runner, state, setupCommonEnv, startTests } = preparedData;
  try {
    await setupCommonEnv(config);
    for (const file of files)
      await startTests([file], runner);
  } finally {
    state.environmentTeardownRun = true;
    debug("finished running tests");
    done(files);
  }
}
window.__vitest_browser_runner__.runTests = runTests;
function __vite__mapDeps(indexes) {
  if (!__vite__mapDeps.viteFileDeps) {
    __vite__mapDeps.viteFileDeps = []
  }
  return indexes.map((i) => __vite__mapDeps.viteFileDeps[i])
}
