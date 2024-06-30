import { createBirpc } from 'birpc';

/*! (c) 2020 Andrea Giammarchi */

const {parse: $parse, stringify: $stringify} = JSON;
const {keys} = Object;

const Primitive = String;   // it could be Number
const primitive = 'string'; // it could be 'number'

const ignore = {};
const object = 'object';

const noop = (_, value) => value;

const primitives = value => (
  value instanceof Primitive ? Primitive(value) : value
);

const Primitives = (_, value) => (
  typeof value === primitive ? new Primitive(value) : value
);

const revive = (input, parsed, output, $) => {
  const lazy = [];
  for (let ke = keys(output), {length} = ke, y = 0; y < length; y++) {
    const k = ke[y];
    const value = output[k];
    if (value instanceof Primitive) {
      const tmp = input[value];
      if (typeof tmp === object && !parsed.has(tmp)) {
        parsed.add(tmp);
        output[k] = ignore;
        lazy.push({k, a: [input, parsed, tmp, $]});
      }
      else
        output[k] = $.call(output, k, tmp);
    }
    else if (output[k] !== ignore)
      output[k] = $.call(output, k, value);
  }
  for (let {length} = lazy, i = 0; i < length; i++) {
    const {k, a} = lazy[i];
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
  const tmp = typeof value === object && value ?
              revive(input, new Set, value, $) :
              value;
  return $.call({'': tmp}, '', tmp);
};

const stringify = (value, replacer, space) => {
  const $ = replacer && typeof replacer === object ?
            (k, v) => (k === '' || -1 < replacer.indexOf(k) ? v : void 0) :
            (replacer || noop);
  const known = new Map;
  const input = [];
  const output = [];
  let i = +set(known, input, $.call({'': value}, '', value));
  let firstRun = !i;
  while (i < input.length) {
    firstRun = true;
    output[i] = $stringify(input[i++], replace, space);
  }
  return '[' + output.join(',') + ']';
  function replace(key, value) {
    if (firstRun) {
      firstRun = !firstRun;
      return value;
    }
    const after = $.call(this, key, value);
    switch (typeof after) {
      case object:
        if (after === null) return after;
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
      if (lastSlash === index - 1 || dots === 1) ; else if (dots === 2) {
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
  filesMap = /* @__PURE__ */ new Map();
  pathsSet = /* @__PURE__ */ new Set();
  idMap = /* @__PURE__ */ new Map();
  taskFileMap = /* @__PURE__ */ new WeakMap();
  errorsSet = /* @__PURE__ */ new Set();
  processTimeoutCauses = /* @__PURE__ */ new Set();
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
        task.result ??= { state: "skip" };
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
  getFiles(keys) {
    if (keys)
      return keys.map((key) => this.filesMap.get(key)).filter(Boolean).flat();
    return Array.from(this.filesMap.values()).flat();
  }
  getFilepaths() {
    return Array.from(this.filesMap.keys());
  }
  getFailedFilepaths() {
    return this.getFiles().filter((i) => i.result?.state === "fail").map((i) => i.filepath);
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
        if (result?.state === "skip")
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
    return Array.from(this.idMap.values()).filter((t) => t.result?.state === "fail").length;
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

function toArray$1(array) {
  if (array === null || array === void 0)
    array = [];
  if (Array.isArray(array))
    return array;
  return [array];
}

function isAtomTest(s) {
  return s.type === "test" || s.type === "custom";
}
function getTests(suite) {
  const tests = [];
  const arraySuites = toArray$1(suite);
  for (const s of arraySuites) {
    if (isAtomTest(s)) {
      tests.push(s);
    } else {
      for (const task of s.tasks) {
        if (isAtomTest(task)) {
          tests.push(task);
        } else {
          const taskTests = getTests(task);
          for (const test of taskTests)
            tests.push(test);
        }
      }
    }
  }
  return tests;
}
function getTasks(tasks = []) {
  return toArray$1(tasks).flatMap((s) => isAtomTest(s) ? [s] : [s, ...getTasks(s.tasks)]);
}
function getSuites(suite) {
  return toArray$1(suite).flatMap((s) => s.type === "suite" ? [s, ...getSuites(s.tasks)] : []);
}
function hasTests(suite) {
  return toArray$1(suite).some((s) => s.tasks.some((c) => isAtomTest(c) || hasTests(c)));
}
function hasFailed(suite) {
  return toArray$1(suite).some((s) => {
    var _a;
    return ((_a = s.result) == null ? void 0 : _a.state) === "fail" || s.type === "suite" && hasFailed(s.tasks);
  });
}
function getNames(task) {
  const names = [task.name];
  let current = task;
  while ((current == null ? void 0 : current.suite) || (current == null ? void 0 : current.file)) {
    current = current.suite || current.file;
    if (current == null ? void 0 : current.name)
      names.unshift(current.name);
  }
  return names;
}

function toArray(array) {
  if (array === null || array === void 0)
    array = [];
  if (Array.isArray(array))
    return array;
  return [array];
}

function hasBenchmark(suite) {
  return toArray(suite).some((s) => s?.tasks?.some((c) => c.meta?.benchmark || hasBenchmark(c)));
}
function hasFailedSnapshot(suite) {
  return getTests(suite).some((s) => {
    return s.result?.errors?.some((e) => typeof e?.message === "string" && e.message.match(/Snapshot .* mismatched/));
  });
}
function getFullName(task, separator = " > ") {
  return getNames(task).join(separator);
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
      ctx.state.collectPaths(paths);
      handlers.onPathsCollected?.(paths);
    },
    onCollected(files) {
      ctx.state.collectFiles(files);
      handlers.onCollected?.(files);
    },
    onTaskUpdate(packs) {
      ctx.state.updateTasks(packs);
      handlers.onTaskUpdate?.(packs);
    },
    onUserConsoleLog(log) {
      ctx.state.updateUserLog(log);
    },
    onFinished(files, errors) {
      handlers.onFinished?.(files, errors);
    },
    onFinishedReportCoverage() {
      handlers.onFinishedReportCoverage?.();
    },
    onCancel(reason) {
      handlers.onCancel?.(reason);
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
    openPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Cannot connect to the server in ${connectTimeout / 1e3} seconds`));
      }, connectTimeout)?.unref?.();
      if (ctx.ws.OPEN === ctx.ws.readyState)
        resolve();
      ctx.ws.addEventListener("open", () => {
        tries = reconnectTries;
        resolve();
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

export { createClient, getFullName, getNames, getSuites, getTasks, getTests, hasBenchmark, hasFailed, hasFailedSnapshot, hasTests };
