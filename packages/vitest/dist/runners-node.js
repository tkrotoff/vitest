import asyncHooks from 'node:async_hooks';
import { promisify } from 'node:util';
import { relative } from 'pathe';
import { r as rpc } from './vendor/rpc.joBhAkyK.js';
import { V as VitestTestRunner } from './vendor/test.HzIA0T0v.js';
import '@vitest/utils';
import './vendor/index.8bPxjt7g.js';
import './vendor/global.CkGT_TMy.js';
import '@vitest/expect';
import './vendor/vi.JYQecGiw.js';
import 'chai';
import './vendor/_commonjsHelpers.jjO7Zipk.js';
import '@vitest/snapshot';
import '@vitest/runner/utils';
import '@vitest/utils/error';
import '@vitest/runner';
import './vendor/tasks.IknbGB2n.js';
import '@vitest/utils/source-map';
import './vendor/base.Xt0Omgh7.js';
import './vendor/date.Ns1pGd_X.js';
import '@vitest/spy';
import './vendor/index.ir9i0ywP.js';
import 'std-env';

const asyncSleep = promisify(setTimeout);
class WithAsyncLeaksDetecter extends VitestTestRunner {
  hangingOps = /* @__PURE__ */ new Map();
  asyncHook = asyncHooks.createHook({
    init: (asyncId, type, triggerAsyncId) => {
      var _a, _b, _c, _d;
      if ([
        "PROMISE",
        "TIMERWRAP",
        "ELDHISTOGRAM",
        "PerformanceObserver",
        "RANDOMBYTESREQUEST",
        "DNSCHANNEL",
        "ZLIB",
        "SIGNREQUEST",
        "TLSWRAP",
        "TCPWRAP"
      ].includes(type))
        return;
      const task = this.workerState.current;
      const filepath = ((_a = task == null ? void 0 : task.file) == null ? void 0 : _a.filepath) || this.workerState.filepath;
      if (!filepath)
        return;
      const { stackTraceLimit } = Error;
      Error.stackTraceLimit = Math.max(100, stackTraceLimit);
      const error = new Error(type);
      let fromUser = (_b = error.stack) == null ? void 0 : _b.includes(filepath);
      let directlyTriggered = true;
      if (!fromUser) {
        const trigger = this.hangingOps.get(triggerAsyncId);
        if (trigger) {
          fromUser = true;
          directlyTriggered = false;
          error.stack = trigger.error.stack;
        }
      }
      if (fromUser) {
        const relativePath = relative(this.config.root, filepath);
        if (directlyTriggered) {
          error.stack = (_d = (_c = error.stack) == null ? void 0 : _c.split(/\n\s+/).findLast((s) => s.includes(filepath))) == null ? void 0 : _d.replace(filepath, relativePath);
        }
        this.hangingOps.set(asyncId, {
          error,
          taskId: (task == null ? void 0 : task.id) || relativePath
        });
      }
    },
    destroy: (asyncId) => {
      this.hangingOps.delete(asyncId);
    }
  });
  onBeforeRunFiles() {
    super.onBeforeRunFiles();
    this.asyncHook.enable();
  }
  async onAfterRunFiles() {
    await asyncSleep(0);
    if (this.hangingOps.size > 0)
      await asyncSleep(0);
    rpc().detectAsyncLeaks(Array.from(this.hangingOps.values()));
    this.asyncHook.disable();
    super.onAfterRunFiles();
  }
}

export { WithAsyncLeaksDetecter };
