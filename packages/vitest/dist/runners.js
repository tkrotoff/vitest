export { V as VitestTestRunner } from './vendor/test.HzIA0T0v.js';
import { updateTask } from '@vitest/runner';
import { createDefer, getSafeTimers } from '@vitest/utils';
import { a as getBenchOptions, g as getBenchFn } from './vendor/benchmark.eeqk2rd8.js';
import './vendor/index.ir9i0ywP.js';
import { g as getWorkerState } from './vendor/global.CkGT_TMy.js';
import '@vitest/expect';
import './vendor/vi.JYQecGiw.js';
import 'chai';
import './vendor/_commonjsHelpers.jjO7Zipk.js';
import '@vitest/snapshot';
import '@vitest/runner/utils';
import '@vitest/utils/error';
import './vendor/tasks.IknbGB2n.js';
import '@vitest/utils/source-map';
import './vendor/base.Xt0Omgh7.js';
import './vendor/date.Ns1pGd_X.js';
import '@vitest/spy';
import './vendor/rpc.joBhAkyK.js';
import './vendor/index.8bPxjt7g.js';
import 'pathe';
import 'std-env';

function createBenchmarkResult(name) {
  return {
    name,
    rank: 0,
    rme: 0,
    samples: []
  };
}
const benchmarkTasks = /* @__PURE__ */ new WeakMap();
async function runBenchmarkSuite(suite, runner) {
  var _a;
  const { Task, Bench } = await runner.importTinybench();
  const start = performance.now();
  const benchmarkGroup = [];
  const benchmarkSuiteGroup = [];
  for (const task of suite.tasks) {
    if (task.mode !== "run")
      continue;
    if ((_a = task.meta) == null ? void 0 : _a.benchmark)
      benchmarkGroup.push(task);
    else if (task.type === "suite")
      benchmarkSuiteGroup.push(task);
  }
  if (benchmarkSuiteGroup.length)
    await Promise.all(benchmarkSuiteGroup.map((subSuite) => runBenchmarkSuite(subSuite, runner)));
  if (benchmarkGroup.length) {
    const defer = createDefer();
    suite.result = {
      state: "run",
      startTime: start,
      benchmark: createBenchmarkResult(suite.name)
    };
    updateTask$1(suite);
    const addBenchTaskListener = (task, benchmark) => {
      task.addEventListener("complete", (e) => {
        const task2 = e.task;
        const taskRes = task2.result;
        const result = benchmark.result.benchmark;
        Object.assign(result, taskRes);
        updateTask$1(benchmark);
      }, {
        once: true
      });
      task.addEventListener("error", (e) => {
        const task2 = e.task;
        defer.reject(benchmark ? task2.result.error : e);
      }, {
        once: true
      });
    };
    benchmarkGroup.forEach((benchmark) => {
      const options = getBenchOptions(benchmark);
      const benchmarkInstance = new Bench(options);
      const benchmarkFn = getBenchFn(benchmark);
      benchmark.result = {
        state: "run",
        startTime: start,
        benchmark: createBenchmarkResult(benchmark.name)
      };
      const task = new Task(benchmarkInstance, benchmark.name, benchmarkFn);
      benchmarkTasks.set(benchmark, task);
      addBenchTaskListener(task, benchmark);
      updateTask$1(benchmark);
    });
    const { setTimeout } = getSafeTimers();
    const tasks = [];
    for (const benchmark of benchmarkGroup) {
      const task = benchmarkTasks.get(benchmark);
      await task.warmup();
      tasks.push([
        await new Promise((resolve) => setTimeout(async () => {
          resolve(await task.run());
        })),
        benchmark
      ]);
    }
    suite.result.duration = performance.now() - start;
    suite.result.state = "pass";
    tasks.sort(([taskA], [taskB]) => taskA.result.mean - taskB.result.mean).forEach(([, benchmark], idx) => {
      benchmark.result.state = "pass";
      if (benchmark) {
        const result = benchmark.result.benchmark;
        result.rank = Number(idx) + 1;
        updateTask$1(benchmark);
      }
    });
    updateTask$1(suite);
    defer.resolve(null);
    await defer;
  }
  function updateTask$1(task) {
    updateTask(task, runner);
  }
}
class NodeBenchmarkRunner {
  constructor(config) {
    this.config = config;
  }
  __vitest_executor;
  async importTinybench() {
    return await import('tinybench');
  }
  importFile(filepath, source) {
    if (source === "setup")
      getWorkerState().moduleCache.delete(filepath);
    return this.__vitest_executor.executeId(filepath);
  }
  async runSuite(suite) {
    await runBenchmarkSuite(suite, this);
  }
  async runTask() {
    throw new Error("`test()` and `it()` is only available in test mode.");
  }
}

export { NodeBenchmarkRunner };
