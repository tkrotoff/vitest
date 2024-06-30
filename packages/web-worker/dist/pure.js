import { VitestExecutor } from 'vitest/execute';
import createDebug from 'debug';
import { MessageChannel } from 'node:worker_threads';

class InlineWorkerRunner extends VitestExecutor {
  constructor(options, context) {
    super(options);
    this.context = context;
  }
  prepareContext(context) {
    const ctx = super.prepareContext(context);
    const importScripts = () => {
      throw new Error("[vitest] `importScripts` is not supported in Vite workers. Please, consider using `import` instead.");
    };
    return Object.assign(ctx, this.context, {
      importScripts
    });
  }
}

const VOID       = -1;
const PRIMITIVE  = 0;
const ARRAY      = 1;
const OBJECT     = 2;
const DATE       = 3;
const REGEXP     = 4;
const MAP        = 5;
const SET        = 6;
const ERROR      = 7;
const BIGINT     = 8;
// export const SYMBOL = 9;

const env = typeof self === 'object' ? self : globalThis;

const deserializer = ($, _) => {
  const as = (out, index) => {
    $.set(index, out);
    return out;
  };

  const unpair = index => {
    if ($.has(index))
      return $.get(index);

    const [type, value] = _[index];
    switch (type) {
      case PRIMITIVE:
      case VOID:
        return as(value, index);
      case ARRAY: {
        const arr = as([], index);
        for (const index of value)
          arr.push(unpair(index));
        return arr;
      }
      case OBJECT: {
        const object = as({}, index);
        for (const [key, index] of value)
          object[unpair(key)] = unpair(index);
        return object;
      }
      case DATE:
        return as(new Date(value), index);
      case REGEXP: {
        const {source, flags} = value;
        return as(new RegExp(source, flags), index);
      }
      case MAP: {
        const map = as(new Map, index);
        for (const [key, index] of value)
          map.set(unpair(key), unpair(index));
        return map;
      }
      case SET: {
        const set = as(new Set, index);
        for (const index of value)
          set.add(unpair(index));
        return set;
      }
      case ERROR: {
        const {name, message} = value;
        return as(new env[name](message), index);
      }
      case BIGINT:
        return as(BigInt(value), index);
      case 'BigInt':
        return as(Object(BigInt(value)), index);
    }
    return as(new env[type](value), index);
  };

  return unpair;
};

/**
 * @typedef {Array<string,any>} Record a type representation
 */

/**
 * Returns a deserialized value from a serialized array of Records.
 * @param {Record[]} serialized a previously serialized value.
 * @returns {any}
 */
const deserialize = serialized => deserializer(new Map, serialized)(0);

const EMPTY = '';

const {toString} = {};
const {keys} = Object;

const typeOf = value => {
  const type = typeof value;
  if (type !== 'object' || !value)
    return [PRIMITIVE, type];

  const asString = toString.call(value).slice(8, -1);
  switch (asString) {
    case 'Array':
      return [ARRAY, EMPTY];
    case 'Object':
      return [OBJECT, EMPTY];
    case 'Date':
      return [DATE, EMPTY];
    case 'RegExp':
      return [REGEXP, EMPTY];
    case 'Map':
      return [MAP, EMPTY];
    case 'Set':
      return [SET, EMPTY];
  }

  if (asString.includes('Array'))
    return [ARRAY, asString];

  if (asString.includes('Error'))
    return [ERROR, asString];

  return [OBJECT, asString];
};

const shouldSkip = ([TYPE, type]) => (
  TYPE === PRIMITIVE &&
  (type === 'function' || type === 'symbol')
);

const serializer = (strict, json, $, _) => {

  const as = (out, value) => {
    const index = _.push(out) - 1;
    $.set(value, index);
    return index;
  };

  const pair = value => {
    if ($.has(value))
      return $.get(value);

    let [TYPE, type] = typeOf(value);
    switch (TYPE) {
      case PRIMITIVE: {
        let entry = value;
        switch (type) {
          case 'bigint':
            TYPE = BIGINT;
            entry = value.toString();
            break;
          case 'function':
          case 'symbol':
            if (strict)
              throw new TypeError('unable to serialize ' + type);
            entry = null;
            break;
          case 'undefined':
            return as([VOID], value);
        }
        return as([TYPE, entry], value);
      }
      case ARRAY: {
        if (type)
          return as([type, [...value]], value);
  
        const arr = [];
        const index = as([TYPE, arr], value);
        for (const entry of value)
          arr.push(pair(entry));
        return index;
      }
      case OBJECT: {
        if (type) {
          switch (type) {
            case 'BigInt':
              return as([type, value.toString()], value);
            case 'Boolean':
            case 'Number':
            case 'String':
              return as([type, value.valueOf()], value);
          }
        }

        if (json && ('toJSON' in value))
          return pair(value.toJSON());

        const entries = [];
        const index = as([TYPE, entries], value);
        for (const key of keys(value)) {
          if (strict || !shouldSkip(typeOf(value[key])))
            entries.push([pair(key), pair(value[key])]);
        }
        return index;
      }
      case DATE:
        return as([TYPE, value.toISOString()], value);
      case REGEXP: {
        const {source, flags} = value;
        return as([TYPE, {source, flags}], value);
      }
      case MAP: {
        const entries = [];
        const index = as([TYPE, entries], value);
        for (const [key, entry] of value) {
          if (strict || !(shouldSkip(typeOf(key)) || shouldSkip(typeOf(entry))))
            entries.push([pair(key), pair(entry)]);
        }
        return index;
      }
      case SET: {
        const entries = [];
        const index = as([TYPE, entries], value);
        for (const entry of value) {
          if (strict || !shouldSkip(typeOf(entry)))
            entries.push(pair(entry));
        }
        return index;
      }
    }

    const {message} = value;
    return as([TYPE, {name: type, message}], value);
  };

  return pair;
};

/**
 * @typedef {Array<string,any>} Record a type representation
 */

/**
 * Returns an array of serialized Records.
 * @param {any} value a serializable value.
 * @param {{json?: boolean, lossy?: boolean}?} options an object with a `lossy` or `json` property that,
 *  if `true`, will not throw errors on incompatible types, and behave more
 *  like JSON stringify would behave. Symbol and Function will be discarded.
 * @returns {Record[]}
 */
 const serialize = (value, {json, lossy} = {}) => {
  const _ = [];
  return serializer(!(json || lossy), !!json, new Map, _)(value), _;
};

/**
 * @typedef {Array<string,any>} Record a type representation
 */

/**
 * Returns an array of serialized Records.
 * @param {any} any a serializable value.
 * @param {{transfer?: any[], json?: boolean, lossy?: boolean}?} options an object with
 * a transfer option (ignored when polyfilled) and/or non standard fields that
 * fallback to the polyfill if present.
 * @returns {Record[]}
 */
var ponyfillStructuredClone = typeof structuredClone === "function" ?
  /* c8 ignore start */
  (any, options) => (
    options && ('json' in options || 'lossy' in options) ?
      deserialize(serialize(any, options)) : structuredClone(any)
  ) :
  (any, options) => deserialize(serialize(any, options));

const debug = createDebug("vitest:web-worker");
function getWorkerState() {
  return globalThis.__vitest_worker__;
}
function assertGlobalExists(name) {
  if (!(name in globalThis))
    throw new Error(`[@vitest/web-worker] Cannot initiate a custom Web Worker. "${name}" is not supported in this environment. Please, consider using jsdom or happy-dom environment.`);
}
function createClonedMessageEvent(data, transferOrOptions, clone) {
  const transfer = Array.isArray(transferOrOptions) ? transferOrOptions : transferOrOptions?.transfer;
  debug("clone worker message %o", data);
  const origin = typeof location === "undefined" ? void 0 : location.origin;
  if (typeof structuredClone === "function" && clone === "native") {
    debug("create message event, using native structured clone");
    return new MessageEvent("message", {
      data: structuredClone(data, { transfer }),
      origin
    });
  }
  if (clone !== "none") {
    debug("create message event, using polyfilled structured clone");
    transfer?.length && console.warn(
      '[@vitest/web-worker] `structuredClone` is not supported in this environment. Falling back to polyfill, your transferable options will be lost. Set `VITEST_WEB_WORKER_CLONE` environmental variable to "none", if you don\'t want to loose it,or update to Node 17+.'
    );
    return new MessageEvent("message", {
      data: ponyfillStructuredClone(data, { lossy: true }),
      origin
    });
  }
  debug("create message event without cloning an object");
  return new MessageEvent("message", {
    data,
    origin
  });
}
function createMessageEvent(data, transferOrOptions, clone) {
  try {
    return createClonedMessageEvent(data, transferOrOptions, clone);
  } catch (error) {
    debug('failed to clone message, dispatch "messageerror" event: %o', error);
    return new MessageEvent("messageerror", {
      data: error
    });
  }
}
function getRunnerOptions() {
  const state = getWorkerState();
  const { config, rpc, mockMap, moduleCache } = state;
  return {
    fetchModule(id) {
      return rpc.fetch(id, "web");
    },
    resolveId(id, importer) {
      return rpc.resolveId(id, importer, "web");
    },
    moduleCache,
    mockMap,
    interopDefault: config.deps.interopDefault ?? true,
    moduleDirectories: config.deps.moduleDirectories,
    root: config.root,
    base: config.base,
    state
  };
}
function stripProtocol(url) {
  return url.toString().replace(/^file:\/+/, "/");
}
function getFileIdFromUrl(url) {
  if (typeof self === "undefined")
    return stripProtocol(url);
  if (!(url instanceof URL))
    url = new URL(url, self.location.origin);
  if (url.protocol === "http:" || url.protocol === "https:")
    return url.pathname;
  return stripProtocol(url);
}

function createWorkerConstructor(options) {
  const runnerOptions = getRunnerOptions();
  const cloneType = () => options?.clone ?? process.env.VITEST_WEB_WORKER_CLONE ?? "native";
  return class Worker extends EventTarget {
    static __VITEST_WEB_WORKER__ = true;
    _vw_workerTarget = new EventTarget();
    _vw_insideListeners = /* @__PURE__ */ new Map();
    _vw_outsideListeners = /* @__PURE__ */ new Map();
    _vw_name;
    _vw_messageQueue = [];
    onmessage = null;
    onmessageerror = null;
    onerror = null;
    constructor(url, options2) {
      super();
      const context = {
        onmessage: null,
        name: options2?.name,
        close: () => this.terminate(),
        dispatchEvent: (event) => {
          return this._vw_workerTarget.dispatchEvent(event);
        },
        addEventListener: (...args) => {
          if (args[1])
            this._vw_insideListeners.set(args[0], args[1]);
          return this._vw_workerTarget.addEventListener(...args);
        },
        removeEventListener: this._vw_workerTarget.removeEventListener,
        postMessage: (...args) => {
          if (!args.length)
            throw new SyntaxError('"postMessage" requires at least one argument.');
          debug("posting message %o from the worker %s to the main thread", args[0], this._vw_name);
          const event = createMessageEvent(args[0], args[1], cloneType());
          this.dispatchEvent(event);
        },
        get self() {
          return context;
        },
        get global() {
          return context;
        }
      };
      this._vw_workerTarget.addEventListener("message", (e) => {
        context.onmessage?.(e);
      });
      this.addEventListener("message", (e) => {
        this.onmessage?.(e);
      });
      this.addEventListener("messageerror", (e) => {
        this.onmessageerror?.(e);
      });
      const runner = new InlineWorkerRunner(runnerOptions, context);
      const id = getFileIdFromUrl(url);
      this._vw_name = id;
      runner.resolveUrl(id).then(([, fsPath]) => {
        this._vw_name = options2?.name ?? fsPath;
        debug("initialize worker %s", this._vw_name);
        return runner.executeFile(fsPath).then(() => {
          runnerOptions.moduleCache.invalidateSubDepTree([fsPath, runner.mocker.getMockPath(fsPath)]);
          const q = this._vw_messageQueue;
          this._vw_messageQueue = null;
          if (q)
            q.forEach(([data, transfer]) => this.postMessage(data, transfer), this);
          debug("worker %s successfully initialized", this._vw_name);
        });
      }).catch((e) => {
        debug("worker %s failed to initialize: %o", this._vw_name, e);
        const EventConstructor = globalThis.ErrorEvent || globalThis.Event;
        const error = new EventConstructor("error", {
          error: e,
          message: e.message
        });
        this.dispatchEvent(error);
        this.onerror?.(error);
        console.error(e);
      });
    }
    addEventListener(type, callback, options2) {
      if (callback)
        this._vw_outsideListeners.set(type, callback);
      return super.addEventListener(type, callback, options2);
    }
    postMessage(...args) {
      if (!args.length)
        throw new SyntaxError('"postMessage" requires at least one argument.');
      const [data, transferOrOptions] = args;
      if (this._vw_messageQueue != null) {
        debug("worker %s is not yet initialized, queue message %s", this._vw_name, data);
        this._vw_messageQueue.push([data, transferOrOptions]);
        return;
      }
      debug("posting message %o from the main thread to the worker %s", data, this._vw_name);
      const event = createMessageEvent(data, transferOrOptions, cloneType());
      if (event.type === "messageerror")
        this.dispatchEvent(event);
      else
        this._vw_workerTarget.dispatchEvent(event);
    }
    terminate() {
      debug("terminating worker %s", this._vw_name);
      this._vw_outsideListeners.forEach((fn, type) => {
        this.removeEventListener(type, fn);
      });
      this._vw_insideListeners.forEach((fn, type) => {
        this._vw_workerTarget.removeEventListener(type, fn);
      });
    }
  };
}

function convertNodePortToWebPort(port) {
  if (!("addEventListener" in port)) {
    Object.defineProperty(port, "addEventListener", {
      value(...args) {
        return this.addListener(...args);
      },
      configurable: true,
      enumerable: true
    });
  }
  if (!("removeEventListener" in port)) {
    Object.defineProperty(port, "removeEventListener", {
      value(...args) {
        return this.removeListener(...args);
      },
      configurable: true,
      enumerable: true
    });
  }
  if (!("dispatchEvent" in port)) {
    const emit = port.emit.bind(port);
    Object.defineProperty(port, "emit", {
      value(event) {
        if (event.name === "message")
          port.onmessage?.(event);
        if (event.name === "messageerror")
          port.onmessageerror?.(event);
        return emit(event);
      },
      configurable: true,
      enumerable: true
    });
    Object.defineProperty(port, "dispatchEvent", {
      value(event) {
        return this.emit(event);
      },
      configurable: true,
      enumerable: true
    });
  }
  return port;
}
function createSharedWorkerConstructor() {
  const runnerOptions = getRunnerOptions();
  return class SharedWorker extends EventTarget {
    static __VITEST_WEB_WORKER__ = true;
    _vw_workerTarget = new EventTarget();
    _vw_name;
    _vw_workerPort;
    onerror = null;
    port;
    constructor(url, options) {
      super();
      const name = typeof options === "string" ? options : options?.name;
      const context = {
        onconnect: null,
        name,
        close: () => this.port.close(),
        dispatchEvent: (event) => {
          return this._vw_workerTarget.dispatchEvent(event);
        },
        addEventListener: (...args) => {
          return this._vw_workerTarget.addEventListener(...args);
        },
        removeEventListener: this._vw_workerTarget.removeEventListener,
        get self() {
          return context;
        },
        get global() {
          return context;
        }
      };
      const channel = new MessageChannel();
      this.port = convertNodePortToWebPort(channel.port1);
      this._vw_workerPort = convertNodePortToWebPort(channel.port2);
      this._vw_workerTarget.addEventListener("connect", (e) => {
        context.onconnect?.(e);
      });
      const runner = new InlineWorkerRunner(runnerOptions, context);
      const id = getFileIdFromUrl(url);
      this._vw_name = id;
      runner.resolveUrl(id).then(([, fsPath]) => {
        this._vw_name = name ?? fsPath;
        debug("initialize shared worker %s", this._vw_name);
        return runner.executeFile(fsPath).then(() => {
          runnerOptions.moduleCache.invalidateSubDepTree([fsPath, runner.mocker.getMockPath(fsPath)]);
          this._vw_workerTarget.dispatchEvent(
            new MessageEvent("connect", {
              ports: [this._vw_workerPort]
            })
          );
          debug("shared worker %s successfully initialized", this._vw_name);
        });
      }).catch((e) => {
        debug("shared worker %s failed to initialize: %o", this._vw_name, e);
        const EventConstructor = globalThis.ErrorEvent || globalThis.Event;
        const error = new EventConstructor("error", {
          error: e,
          message: e.message
        });
        this.dispatchEvent(error);
        this.onerror?.(error);
        console.error(e);
      });
    }
  };
}

function defineWebWorkers(options) {
  if (typeof Worker === "undefined" || !("__VITEST_WEB_WORKER__" in globalThis.Worker)) {
    assertGlobalExists("EventTarget");
    assertGlobalExists("MessageEvent");
    globalThis.Worker = createWorkerConstructor(options);
  }
  if (typeof SharedWorker === "undefined" || !("__VITEST_WEB_WORKER__" in globalThis.SharedWorker)) {
    assertGlobalExists("EventTarget");
    globalThis.SharedWorker = createSharedWorkerConstructor();
  }
}

export { defineWebWorkers };
