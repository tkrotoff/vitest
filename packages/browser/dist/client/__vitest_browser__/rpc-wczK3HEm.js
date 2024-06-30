var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity)
      fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy)
      fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous")
      fetchOpts.credentials = "omit";
    else
      fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
const DEFAULT_TIMEOUT = 6e4;
function defaultSerialize(i) {
  return i;
}
const defaultDeserialize = defaultSerialize;
const { clearTimeout: clearTimeout$1, setTimeout: setTimeout$1 } = globalThis;
const random = Math.random.bind(Math);
function createBirpc(functions, options) {
  const {
    post,
    on,
    eventNames = [],
    serialize = defaultSerialize,
    deserialize = defaultDeserialize,
    resolver,
    timeout = DEFAULT_TIMEOUT
  } = options;
  const rpcPromiseMap = /* @__PURE__ */ new Map();
  let _promise;
  const rpc2 = new Proxy({}, {
    get(_, method) {
      if (method === "$functions")
        return functions;
      const sendEvent = (...args) => {
        post(serialize({ m: method, a: args, t: "q" }));
      };
      if (eventNames.includes(method)) {
        sendEvent.asEvent = sendEvent;
        return sendEvent;
      }
      const sendCall = async (...args) => {
        await _promise;
        return new Promise((resolve2, reject) => {
          var _a, _b;
          const id = nanoid();
          let timeoutId;
          if (timeout >= 0) {
            timeoutId = (_b = (_a = setTimeout$1(() => {
              var _a2;
              try {
                (_a2 = options.onTimeoutError) == null ? void 0 : _a2.call(options, method, args);
                throw new Error(`[birpc] timeout on calling "${method}"`);
              } catch (e) {
                reject(e);
              }
              rpcPromiseMap.delete(id);
            }, timeout)).unref) == null ? void 0 : _b.call(_a);
          }
          rpcPromiseMap.set(id, { resolve: resolve2, reject, timeoutId });
          post(serialize({ m: method, a: args, i: id, t: "q" }));
        });
      };
      sendCall.asEvent = sendEvent;
      return sendCall;
    }
  });
  _promise = on(async (data, ...extra) => {
    const msg = deserialize(data);
    if (msg.t === "q") {
      const { m: method, a: args } = msg;
      let result, error;
      const fn = resolver ? resolver(method, functions[method]) : functions[method];
      if (!fn) {
        error = new Error(`[birpc] function "${method}" not found`);
      } else {
        try {
          result = await fn.apply(rpc2, args);
        } catch (e) {
          error = e;
        }
      }
      if (msg.i) {
        if (error && options.onError)
          options.onError(error, method, args);
        post(serialize({ t: "s", i: msg.i, r: result, e: error }), ...extra);
      }
    } else {
      const { i: ack, r: result, e: error } = msg;
      const promise = rpcPromiseMap.get(ack);
      if (promise) {
        clearTimeout$1(promise.timeoutId);
        if (error)
          promise.reject(error);
        else
          promise.resolve(result);
      }
      rpcPromiseMap.delete(ack);
    }
  });
  return rpc2;
}
const urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
function nanoid(size = 21) {
  let id = "";
  let i = size;
  while (i--)
    id += urlAlphabet[random() * 64 | 0];
  return id;
}
/*! (c) 2020 Andrea Giammarchi */
const { parse: $parse, stringify: $stringify } = JSON;
const { keys } = Object;
const Primitive = String;
const primitive = "string";
const ignore = {};
const object = "object";
const noop = (_, value) => value;
const primitives = (value) => value instanceof Primitive ? Primitive(value) : value;
const Primitives = (_, value) => typeof value === primitive ? new Primitive(value) : value;
const revive = (input, parsed, output, $) => {
  const lazy = [];
  for (let ke = keys(output), { length } = ke, y = 0; y < length; y++) {
    const k = ke[y];
    const value = output[k];
    if (value instanceof Primitive) {
      const tmp = input[value];
      if (typeof tmp === object && !parsed.has(tmp)) {
        parsed.add(tmp);
        output[k] = ignore;
        lazy.push({ k, a: [input, parsed, tmp, $] });
      } else
        output[k] = $.call(output, k, tmp);
    } else if (output[k] !== ignore)
      output[k] = $.call(output, k, value);
  }
  for (let { length } = lazy, i = 0; i < length; i++) {
    const { k, a } = lazy[i];
    output[k] = $.call(output, k, revive.apply(null, a));
  }
  return output;
};
const set = (known, input, value) => {
  const index = Primitive(input.push(value) - 1);
  known.set(value, index);
  return index;
};
const parse = (text, reviver) => {
  const input = $parse(text, Primitives).map(primitives);
  const value = input[0];
  const $ = reviver || noop;
  const tmp = typeof value === object && value ? revive(input, /* @__PURE__ */ new Set(), value, $) : value;
  return $.call({ "": tmp }, "", tmp);
};
const stringify = (value, replacer, space) => {
  const $ = replacer && typeof replacer === object ? (k, v) => k === "" || -1 < replacer.indexOf(k) ? v : void 0 : replacer || noop;
  const known = /* @__PURE__ */ new Map();
  const input = [];
  const output = [];
  let i = +set(known, input, $.call({ "": value }, "", value));
  let firstRun = !i;
  while (i < input.length) {
    firstRun = true;
    output[i] = $stringify(input[i++], replace, space);
  }
  return "[" + output.join(",") + "]";
  function replace(key, value2) {
    if (firstRun) {
      firstRun = !firstRun;
      return value2;
    }
    const after = $.call(this, key, value2);
    switch (typeof after) {
      case object:
        if (after === null)
          return after;
      case primitive:
        return known.get(after) || set(known, input, after);
    }
    return after;
  }
};
function normalizeWindowsPath(input = "") {
  if (!input || !input.includes("\\")) {
    return input;
  }
  return input.replace(/\\/g, "/");
}
const _IS_ABSOLUTE_RE = /^[/\\](?![/\\])|^[/\\]{2}(?!\.)|^[A-Za-z]:[/\\]/;
function cwd() {
  if (typeof process !== "undefined") {
    return process.cwd().replace(/\\/g, "/");
  }
  return "/";
}
const resolve = function(...arguments_) {
  arguments_ = arguments_.map((argument) => normalizeWindowsPath(argument));
  let resolvedPath = "";
  let resolvedAbsolute = false;
  for (let index = arguments_.length - 1; index >= -1 && !resolvedAbsolute; index--) {
    const path = index >= 0 ? arguments_[index] : cwd();
    if (!path || path.length === 0) {
      continue;
    }
    resolvedPath = `${path}/${resolvedPath}`;
    resolvedAbsolute = isAbsolute(path);
  }
  resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute);
  if (resolvedAbsolute && !isAbsolute(resolvedPath)) {
    return `/${resolvedPath}`;
  }
  return resolvedPath.length > 0 ? resolvedPath : ".";
};
function normalizeString(path, allowAboveRoot) {
  let res = "";
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let char = null;
  for (let index = 0; index <= path.length; ++index) {
    if (index < path.length) {
      char = path[index];
    } else if (char === "/") {
      break;
    } else {
      char = "/";
    }
    if (char === "/") {
      if (lastSlash === index - 1 || dots === 1)
        ;
      else if (dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res[res.length - 1] !== "." || res[res.length - 2] !== ".") {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf("/");
            if (lastSlashIndex === -1) {
              res = "";
              lastSegmentLength = 0;
            } else {
              res = res.slice(0, lastSlashIndex);
              lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
            }
            lastSlash = index;
            dots = 0;
            continue;
          } else if (res.length > 0) {
            res = "";
            lastSegmentLength = 0;
            lastSlash = index;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          res += res.length > 0 ? "/.." : "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0) {
          res += `/${path.slice(lastSlash + 1, index)}`;
        } else {
          res = path.slice(lastSlash + 1, index);
        }
        lastSegmentLength = index - lastSlash - 1;
      }
      lastSlash = index;
      dots = 0;
    } else if (char === "." && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}
const isAbsolute = function(p) {
  return _IS_ABSOLUTE_RE.test(p);
};
const relative = function(from, to) {
  const _from = resolve(from).split("/");
  const _to = resolve(to).split("/");
  const _fromCopy = [..._from];
  for (const segment of _fromCopy) {
    if (_to[0] !== segment) {
      break;
    }
    _from.shift();
    _to.shift();
  }
  return [..._from.map(() => ".."), ..._to].join("/");
};
function isAggregateError(err) {
  if (typeof AggregateError !== "undefined" && err instanceof AggregateError)
    return true;
  return err instanceof Error && "errors" in err;
}
class StateManager {
  constructor() {
    __publicField(this, "filesMap", /* @__PURE__ */ new Map());
    __publicField(this, "pathsSet", /* @__PURE__ */ new Set());
    __publicField(this, "idMap", /* @__PURE__ */ new Map());
    __publicField(this, "taskFileMap", /* @__PURE__ */ new WeakMap());
    __publicField(this, "errorsSet", /* @__PURE__ */ new Set());
    __publicField(this, "processTimeoutCauses", /* @__PURE__ */ new Set());
  }
  catchError(err, type) {
    if (isAggregateError(err))
      return err.errors.forEach((error) => this.catchError(error, type));
    if (err === Object(err))
      err.type = type;
    else
      err = { type, message: err };
    const _err = err;
    if (_err && typeof _err === "object" && _err.code === "VITEST_PENDING") {
      const task = this.idMap.get(_err.taskId);
      if (task) {
        task.mode = "skip";
        task.result ?? (task.result = { state: "skip" });
        task.result.state = "skip";
      }
      return;
    }
    this.errorsSet.add(err);
  }
  clearErrors() {
    this.errorsSet.clear();
  }
  getUnhandledErrors() {
    return Array.from(this.errorsSet.values());
  }
  addProcessTimeoutCause(cause) {
    this.processTimeoutCauses.add(cause);
  }
  getProcessTimeoutCauses() {
    return Array.from(this.processTimeoutCauses.values());
  }
  getPaths() {
    return Array.from(this.pathsSet);
  }
  getFiles(keys2) {
    if (keys2)
      return keys2.map((key) => this.filesMap.get(key)).filter(Boolean).flat();
    return Array.from(this.filesMap.values()).flat();
  }
  getFilepaths() {
    return Array.from(this.filesMap.keys());
  }
  getFailedFilepaths() {
    return this.getFiles().filter((i) => {
      var _a;
      return ((_a = i.result) == null ? void 0 : _a.state) === "fail";
    }).map((i) => i.filepath);
  }
  collectPaths(paths = []) {
    paths.forEach((path) => {
      this.pathsSet.add(path);
    });
  }
  collectFiles(files = []) {
    files.forEach((file) => {
      const existing = this.filesMap.get(file.filepath) || [];
      const otherProject = existing.filter((i) => i.projectName !== file.projectName);
      otherProject.push(file);
      this.filesMap.set(file.filepath, otherProject);
      this.updateId(file);
    });
  }
  // this file is reused by ws-client, and shoult not rely on heavy dependencies like workspace
  clearFiles(_project, paths = []) {
    const project = _project;
    paths.forEach((path) => {
      const files = this.filesMap.get(path);
      if (!files)
        return;
      const filtered = files.filter((file) => file.projectName !== project.config.name);
      if (!filtered.length)
        this.filesMap.delete(path);
      else
        this.filesMap.set(path, filtered);
    });
  }
  updateId(task) {
    if (this.idMap.get(task.id) === task)
      return;
    this.idMap.set(task.id, task);
    if (task.type === "suite") {
      task.tasks.forEach((task2) => {
        this.updateId(task2);
      });
    }
  }
  updateTasks(packs) {
    for (const [id, result, meta] of packs) {
      const task = this.idMap.get(id);
      if (task) {
        task.result = result;
        task.meta = meta;
        if ((result == null ? void 0 : result.state) === "skip")
          task.mode = "skip";
      }
    }
  }
  updateUserLog(log) {
    const task = log.taskId && this.idMap.get(log.taskId);
    if (task) {
      if (!task.logs)
        task.logs = [];
      task.logs.push(log);
    }
  }
  getCountOfFailedTests() {
    return Array.from(this.idMap.values()).filter((t) => {
      var _a;
      return ((_a = t.result) == null ? void 0 : _a.state) === "fail";
    }).length;
  }
  cancelFiles(files, root, projectName) {
    this.collectFiles(files.map((filepath) => ({
      filepath,
      name: relative(root, filepath),
      id: filepath,
      mode: "skip",
      type: "suite",
      result: {
        state: "skip"
      },
      meta: {},
      // Cancelled files have not yet collected tests
      tasks: [],
      projectName
    })));
  }
}
function createClient(url, options = {}) {
  const {
    handlers = {},
    autoReconnect = true,
    reconnectInterval = 2e3,
    reconnectTries = 10,
    connectTimeout = 6e4,
    reactive = (v) => v,
    WebSocketConstructor = globalThis.WebSocket
  } = options;
  let tries = reconnectTries;
  const ctx = reactive({
    ws: new WebSocketConstructor(url),
    state: new StateManager(),
    waitForConnection,
    reconnect
  });
  ctx.state.filesMap = reactive(ctx.state.filesMap);
  ctx.state.idMap = reactive(ctx.state.idMap);
  let onMessage;
  const functions = {
    onPathsCollected(paths) {
      var _a;
      ctx.state.collectPaths(paths);
      (_a = handlers.onPathsCollected) == null ? void 0 : _a.call(handlers, paths);
    },
    onCollected(files) {
      var _a;
      ctx.state.collectFiles(files);
      (_a = handlers.onCollected) == null ? void 0 : _a.call(handlers, files);
    },
    onTaskUpdate(packs) {
      var _a;
      ctx.state.updateTasks(packs);
      (_a = handlers.onTaskUpdate) == null ? void 0 : _a.call(handlers, packs);
    },
    onUserConsoleLog(log) {
      ctx.state.updateUserLog(log);
    },
    onFinished(files, errors) {
      var _a;
      (_a = handlers.onFinished) == null ? void 0 : _a.call(handlers, files, errors);
    },
    onFinishedReportCoverage() {
      var _a;
      (_a = handlers.onFinishedReportCoverage) == null ? void 0 : _a.call(handlers);
    },
    onCancel(reason) {
      var _a;
      (_a = handlers.onCancel) == null ? void 0 : _a.call(handlers, reason);
    }
  };
  const birpcHandlers = {
    post: (msg) => ctx.ws.send(msg),
    on: (fn) => onMessage = fn,
    serialize: stringify,
    deserialize: parse,
    onTimeoutError(functionName) {
      throw new Error(`[vitest-ws-client]: Timeout calling "${functionName}"`);
    }
  };
  ctx.rpc = createBirpc(
    functions,
    birpcHandlers
  );
  let openPromise;
  function reconnect(reset = false) {
    if (reset)
      tries = reconnectTries;
    ctx.ws = new WebSocketConstructor(url);
    registerWS();
  }
  function registerWS() {
    openPromise = new Promise((resolve2, reject) => {
      var _a, _b;
      const timeout = (_b = (_a = setTimeout(() => {
        reject(new Error(`Cannot connect to the server in ${connectTimeout / 1e3} seconds`));
      }, connectTimeout)) == null ? void 0 : _a.unref) == null ? void 0 : _b.call(_a);
      if (ctx.ws.OPEN === ctx.ws.readyState)
        resolve2();
      ctx.ws.addEventListener("open", () => {
        tries = reconnectTries;
        resolve2();
        clearTimeout(timeout);
      });
    });
    ctx.ws.addEventListener("message", (v) => {
      onMessage(v.data);
    });
    ctx.ws.addEventListener("close", () => {
      tries -= 1;
      if (autoReconnect && tries > 0)
        setTimeout(reconnect, reconnectInterval);
    });
  }
  registerWS();
  function waitForConnection() {
    return openPromise;
  }
  return ctx;
}
const PORT = location.port;
const HOST = [location.hostname, PORT].filter(Boolean).join(":");
const ENTRY_URL = `${location.protocol === "https:" ? "wss:" : "ws:"}//${HOST}/__vitest_api__`;
let setCancel = (_) => {
};
const onCancel = new Promise((resolve2) => {
  setCancel = resolve2;
});
const client = createClient(ENTRY_URL, {
  handlers: {
    onCancel: setCancel
  }
});
const channel = new BroadcastChannel("vitest");
const scriptRel = "modulepreload";
const assetsURL = function(dep) {
  return "/" + dep;
};
const seen = {};
const __vitePreload = function preload(baseModule, deps, importerUrl) {
  let promise = Promise.resolve();
  if (deps && deps.length > 0) {
    const links = document.getElementsByTagName("link");
    promise = Promise.all(deps.map((dep) => {
      dep = assetsURL(dep);
      if (dep in seen)
        return;
      seen[dep] = true;
      const isCss = dep.endsWith(".css");
      const cssSelector = isCss ? '[rel="stylesheet"]' : "";
      const isBaseRelative = !!importerUrl;
      if (isBaseRelative) {
        for (let i = links.length - 1; i >= 0; i--) {
          const link2 = links[i];
          if (link2.href === dep && (!isCss || link2.rel === "stylesheet")) {
            return;
          }
        }
      } else if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) {
        return;
      }
      const link = document.createElement("link");
      link.rel = isCss ? "stylesheet" : scriptRel;
      if (!isCss) {
        link.as = "script";
        link.crossOrigin = "";
      }
      link.href = dep;
      document.head.appendChild(link);
      if (isCss) {
        return new Promise((res, rej) => {
          link.addEventListener("load", res);
          link.addEventListener("error", () => rej(new Error(`Unable to preload CSS for ${dep}`)));
        });
      }
    }));
  }
  return promise.then(() => baseModule()).catch((err) => {
    const e = new Event("vite:preloadError", { cancelable: true });
    e.payload = err;
    window.dispatchEvent(e);
    if (!e.defaultPrevented) {
      throw err;
    }
  });
};
async function importId(id) {
  const name = `${getConfig().base || "/"}@id/${id}`;
  return getBrowserState().wrapModule(__vitePreload(() => import(name), true ? __vite__mapDeps([]) : void 0));
}
function getConfig() {
  return getBrowserState().config;
}
function getBrowserState() {
  return window.__vitest_browser_runner__;
}
const { get } = Reflect;
function withSafeTimers(getTimers, fn) {
  const { setTimeout: setTimeout2, clearTimeout: clearTimeout2, setImmediate, clearImmediate } = getTimers();
  const currentSetTimeout = globalThis.setTimeout;
  const currentClearTimeout = globalThis.clearTimeout;
  const currentSetImmediate = globalThis.setImmediate;
  const currentClearImmediate = globalThis.clearImmediate;
  try {
    globalThis.setTimeout = setTimeout2;
    globalThis.clearTimeout = clearTimeout2;
    globalThis.setImmediate = setImmediate;
    globalThis.clearImmediate = clearImmediate;
    const result = fn();
    return result;
  } finally {
    globalThis.setTimeout = currentSetTimeout;
    globalThis.clearTimeout = currentClearTimeout;
    globalThis.setImmediate = currentSetImmediate;
    globalThis.clearImmediate = currentClearImmediate;
  }
}
const promises = /* @__PURE__ */ new Set();
async function rpcDone() {
  if (!promises.size)
    return;
  const awaitable = Array.from(promises);
  return Promise.all(awaitable);
}
function createSafeRpc(client2, getTimers) {
  return new Proxy(client2.rpc, {
    get(target, p, handler) {
      if (p === "then")
        return;
      const sendCall = get(target, p, handler);
      const safeSendCall = (...args) => withSafeTimers(getTimers, async () => {
        const result = sendCall(...args);
        promises.add(result);
        try {
          return await result;
        } finally {
          promises.delete(result);
        }
      });
      safeSendCall.asEvent = sendCall.asEvent;
      return safeSendCall;
    }
  });
}
async function loadSafeRpc(client2) {
  const { getSafeTimers } = await importId("vitest/utils");
  return createSafeRpc(client2, getSafeTimers);
}
function rpc() {
  return globalThis.__vitest_worker__.rpc;
}
export {
  __vitePreload as _,
  getBrowserState as a,
  channel as b,
  client as c,
  rpc as d,
  getConfig as g,
  importId as i,
  loadSafeRpc as l,
  onCancel as o,
  rpcDone as r
};
function __vite__mapDeps(indexes) {
  if (!__vite__mapDeps.viteFileDeps) {
    __vite__mapDeps.viteFileDeps = []
  }
  return indexes.map((i) => __vite__mapDeps.viteFileDeps[i])
}
