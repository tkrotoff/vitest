import { setState, GLOBAL_EXPECT, getState } from '@vitest/expect';
import { g as getSnapshotClient, c as createExpect, v as vi } from './vi.JYQecGiw.js';
import './index.ir9i0ywP.js';
import { r as rpc } from './rpc.joBhAkyK.js';
import { g as getFullName } from './tasks.IknbGB2n.js';
import { g as getWorkerState } from './global.CkGT_TMy.js';
import { getTests, getNames } from '@vitest/runner/utils';

class VitestTestRunner {
  constructor(config) {
    this.config = config;
  }
  snapshotClient = getSnapshotClient();
  workerState = getWorkerState();
  __vitest_executor;
  cancelRun = false;
  importFile(filepath, source) {
    if (source === "setup")
      this.workerState.moduleCache.delete(filepath);
    return this.__vitest_executor.executeId(filepath);
  }
  onBeforeRunFiles() {
    this.snapshotClient.clear();
  }
  onAfterRunFiles() {
    this.workerState.current = void 0;
  }
  async onAfterRunSuite(suite) {
    if (this.config.logHeapUsage && typeof process !== "undefined")
      suite.result.heap = process.memoryUsage().heapUsed;
    if (suite.mode !== "skip" && typeof suite.filepath !== "undefined") {
      for (const test of getTests(suite)) {
        if (test.mode === "skip") {
          const name = getNames(test).slice(1).join(" > ");
          this.snapshotClient.skipTestSnapshots(name);
        }
      }
      const result = await this.snapshotClient.finishCurrentRun();
      if (result)
        await rpc().snapshotSaved(result);
    }
    this.workerState.current = suite.suite;
  }
  onAfterRunTask(test) {
    this.snapshotClient.clearTest();
    if (this.config.logHeapUsage && typeof process !== "undefined")
      test.result.heap = process.memoryUsage().heapUsed;
    this.workerState.current = test.suite;
  }
  onCancel(_reason) {
    this.cancelRun = true;
  }
  async onBeforeRunTask(test) {
    if (this.cancelRun)
      test.mode = "skip";
    if (test.mode !== "run")
      return;
    clearModuleMocks(this.config);
    this.workerState.current = test;
  }
  async onBeforeRunSuite(suite) {
    if (this.cancelRun)
      suite.mode = "skip";
    if (suite.mode !== "skip" && typeof suite.filepath !== "undefined") {
      await this.snapshotClient.startCurrentRun(suite.filepath, "__default_name_", this.workerState.config.snapshotOptions);
    }
    this.workerState.current = suite;
  }
  onBeforeTryTask(test) {
    var _a, _b;
    setState({
      assertionCalls: 0,
      isExpectingAssertions: false,
      isExpectingAssertionsError: null,
      expectedAssertionsNumber: null,
      expectedAssertionsNumberErrorGen: null,
      testPath: (_b = (_a = test.suite) == null ? void 0 : _a.file) == null ? void 0 : _b.filepath,
      currentTestName: getFullName(test),
      snapshotState: this.snapshotClient.snapshotState
    }, globalThis[GLOBAL_EXPECT]);
  }
  onAfterTryTask(test) {
    const {
      assertionCalls,
      expectedAssertionsNumber,
      expectedAssertionsNumberErrorGen,
      isExpectingAssertions,
      isExpectingAssertionsError
      // @ts-expect-error _local is untyped
    } = "context" in test && test.context._local ? test.context.expect.getState() : getState(globalThis[GLOBAL_EXPECT]);
    if (expectedAssertionsNumber !== null && assertionCalls !== expectedAssertionsNumber)
      throw expectedAssertionsNumberErrorGen();
    if (isExpectingAssertions === true && assertionCalls === 0)
      throw isExpectingAssertionsError;
  }
  extendTaskContext(context) {
    let _expect;
    Object.defineProperty(context, "expect", {
      get() {
        if (!_expect)
          _expect = createExpect(context.task);
        return _expect;
      }
    });
    Object.defineProperty(context, "_local", {
      get() {
        return _expect != null;
      }
    });
    return context;
  }
}
function clearModuleMocks(config) {
  const { clearMocks, mockReset, restoreMocks, unstubEnvs, unstubGlobals } = config;
  if (restoreMocks)
    vi.restoreAllMocks();
  else if (mockReset)
    vi.resetAllMocks();
  else if (clearMocks)
    vi.clearAllMocks();
  if (unstubEnvs)
    vi.unstubAllEnvs();
  if (unstubGlobals)
    vi.unstubAllGlobals();
}

export { VitestTestRunner as V };
