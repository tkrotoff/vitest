import { isatty } from 'node:tty';
import { createRequire } from 'node:module';
import util from 'node:util';
import timers from 'node:timers';
import { performance } from 'node:perf_hooks';
import { startTests } from '@vitest/runner';
import { setupColors, createColors } from '@vitest/utils';
import { installSourcemapsSupport } from 'vite-node/source-map';
import { V as VitestSnapshotEnvironment, s as setupChaiConfig, r as resolveTestRunner } from '../vendor/index.lv0q9Btl.js';
import { a as startCoverageInsideWorker, s as stopCoverageInsideWorker } from '../vendor/coverage.E7sG1b3r.js';
import { g as getWorkerState } from '../vendor/global.CkGT_TMy.js';
import { V as VitestIndex } from '../vendor/index.BeX1oZht.js';
import { s as setupCommonEnv } from '../vendor/setup-common.vyF1kALR.js';
import 'chai';
import '@vitest/snapshot/environment';
import 'pathe';
import '../path.js';
import 'node:url';
import '../vendor/rpc.joBhAkyK.js';
import '../vendor/index.8bPxjt7g.js';
import '../vendor/benchmark.eeqk2rd8.js';
import '@vitest/runner/utils';
import '../vendor/index.ir9i0ywP.js';
import 'std-env';
import '../vendor/run-once.Olz_Zkd8.js';
import '../vendor/vi.JYQecGiw.js';
import '../vendor/_commonjsHelpers.jjO7Zipk.js';
import '@vitest/expect';
import '@vitest/snapshot';
import '@vitest/utils/error';
import '../vendor/tasks.IknbGB2n.js';
import '@vitest/utils/source-map';
import '../vendor/base.Xt0Omgh7.js';
import '../vendor/date.Ns1pGd_X.js';
import '@vitest/spy';

async function run(files, config, executor) {
  const workerState = getWorkerState();
  await setupCommonEnv(config);
  Object.defineProperty(globalThis, "__vitest_index__", {
    value: VitestIndex,
    enumerable: false
  });
  config.snapshotOptions.snapshotEnvironment = new VitestSnapshotEnvironment(workerState.rpc);
  setupColors(createColors(isatty(1)));
  if (workerState.environment.transformMode === "web") {
    const _require = createRequire(import.meta.url);
    _require.extensions[".css"] = () => ({});
    _require.extensions[".scss"] = () => ({});
    _require.extensions[".sass"] = () => ({});
    _require.extensions[".less"] = () => ({});
  }
  globalThis.__vitest_required__ = {
    util,
    timers
  };
  installSourcemapsSupport({
    getSourceMap: (source) => workerState.moduleCache.getSourceMap(source)
  });
  await startCoverageInsideWorker(config.coverage, executor);
  if (config.chaiConfig)
    setupChaiConfig(config.chaiConfig);
  const runner = await resolveTestRunner(config, executor);
  workerState.durations.prepare = performance.now() - workerState.durations.prepare;
  const { vi } = VitestIndex;
  for (const file of files) {
    workerState.filepath = file;
    await startTests([file], runner);
    vi.resetConfig();
    vi.restoreAllMocks();
  }
  await stopCoverageInsideWorker(config.coverage, executor);
}

export { run };
