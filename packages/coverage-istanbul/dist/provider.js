import { promises, existsSync, writeFileSync } from 'node:fs';
import { coverageConfigDefaults, defaultExclude, defaultInclude } from 'vitest/config';
import { BaseCoverageProvider } from 'vitest/coverage';
import c from 'picocolors';
import { parseModule } from 'magicast';
import createDebug from 'debug';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';
import libCoverage from 'istanbul-lib-coverage';
import libSourceMaps from 'istanbul-lib-source-maps';
import { createInstrumenter } from 'istanbul-lib-instrument';
import _TestExclude from 'test-exclude';
import { C as COVERAGE_STORE_KEY } from './constants-DBqnqzn-.js';

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

const DEFAULT_PROJECT = Symbol.for("default-project");
const debug = createDebug("vitest:coverage");
let uniqueId = 0;
class IstanbulCoverageProvider extends BaseCoverageProvider {
  name = "istanbul";
  ctx;
  options;
  instrumenter;
  testExclude;
  coverageFiles = /* @__PURE__ */ new Map();
  coverageFilesDirectory;
  pendingPromises = [];
  initialize(ctx) {
    const config = ctx.config.coverage;
    this.ctx = ctx;
    this.options = {
      ...coverageConfigDefaults,
      // User's options
      ...config,
      // Resolved fields
      provider: "istanbul",
      reportsDirectory: resolve(ctx.config.root, config.reportsDirectory || coverageConfigDefaults.reportsDirectory),
      reporter: this.resolveReporters(config.reporter || coverageConfigDefaults.reporter),
      thresholds: config.thresholds && {
        ...config.thresholds,
        lines: config.thresholds["100"] ? 100 : config.thresholds.lines,
        branches: config.thresholds["100"] ? 100 : config.thresholds.branches,
        functions: config.thresholds["100"] ? 100 : config.thresholds.functions,
        statements: config.thresholds["100"] ? 100 : config.thresholds.statements
      }
    };
    this.instrumenter = createInstrumenter({
      produceSourceMap: true,
      autoWrap: false,
      esModules: true,
      compact: false,
      coverageVariable: COVERAGE_STORE_KEY,
      // @ts-expect-error missing type
      coverageGlobalScope: "globalThis",
      coverageGlobalScopeFunc: false,
      ignoreClassMethods: this.options.ignoreClassMethods
    });
    this.testExclude = new _TestExclude({
      cwd: ctx.config.root,
      include: typeof this.options.include === "undefined" ? void 0 : [...this.options.include],
      exclude: [...defaultExclude, ...defaultInclude, ...this.options.exclude],
      excludeNodeModules: true,
      extension: this.options.extension,
      relativePath: !this.options.allowExternal
    });
    const shard = this.ctx.config.shard;
    const tempDirectory = `.tmp${shard ? `-${shard.index}-${shard.count}` : ""}`;
    this.coverageFilesDirectory = resolve(this.options.reportsDirectory, tempDirectory);
  }
  resolveOptions() {
    return this.options;
  }
  onFileTransform(sourceCode, id, pluginCtx) {
    if (!this.testExclude.shouldInstrument(id))
      return;
    const sourceMap = pluginCtx.getCombinedSourcemap();
    sourceMap.sources = sourceMap.sources.map(removeQueryParameters);
    sourceCode = sourceCode.replaceAll("_ts_decorate", "/* istanbul ignore next */_ts_decorate");
    const code = this.instrumenter.instrumentSync(sourceCode, id, sourceMap);
    const map = this.instrumenter.lastSourceMap();
    return { code, map };
  }
  /*
   * Coverage and meta information passed from Vitest runners.
   * Note that adding new entries here and requiring on those without
   * backwards compatibility is a breaking change.
   */
  onAfterSuiteRun({ coverage, transformMode, projectName }) {
    if (!coverage)
      return;
    if (transformMode !== "web" && transformMode !== "ssr")
      throw new Error(`Invalid transform mode: ${transformMode}`);
    let entry = this.coverageFiles.get(projectName || DEFAULT_PROJECT);
    if (!entry) {
      entry = { web: [], ssr: [] };
      this.coverageFiles.set(projectName || DEFAULT_PROJECT, entry);
    }
    const filename = resolve(this.coverageFilesDirectory, `coverage-${uniqueId++}.json`);
    entry[transformMode].push(filename);
    const promise = promises.writeFile(filename, JSON.stringify(coverage), "utf-8");
    this.pendingPromises.push(promise);
  }
  async clean(clean = true) {
    if (clean && existsSync(this.options.reportsDirectory))
      await promises.rm(this.options.reportsDirectory, { recursive: true, force: true, maxRetries: 10 });
    if (existsSync(this.coverageFilesDirectory))
      await promises.rm(this.coverageFilesDirectory, { recursive: true, force: true, maxRetries: 10 });
    await promises.mkdir(this.coverageFilesDirectory, { recursive: true });
    this.coverageFiles = /* @__PURE__ */ new Map();
    this.pendingPromises = [];
  }
  async reportCoverage({ allTestsRun } = {}) {
    const coverageMap = libCoverage.createCoverageMap({});
    let index = 0;
    const total = this.pendingPromises.length;
    await Promise.all(this.pendingPromises);
    this.pendingPromises = [];
    for (const coveragePerProject of this.coverageFiles.values()) {
      for (const filenames of [coveragePerProject.ssr, coveragePerProject.web]) {
        const coverageMapByTransformMode = libCoverage.createCoverageMap({});
        for (const chunk of this.toSlices(filenames, this.options.processingConcurrency)) {
          if (debug.enabled) {
            index += chunk.length;
            debug("Covered files %d/%d", index, total);
          }
          await Promise.all(chunk.map(async (filename) => {
            const contents = await promises.readFile(filename, "utf-8");
            const coverage = JSON.parse(contents);
            coverageMapByTransformMode.merge(coverage);
          }));
        }
        const transformedCoverage = await transformCoverage(coverageMapByTransformMode);
        coverageMap.merge(transformedCoverage);
      }
    }
    if (this.options.all && allTestsRun) {
      const coveredFiles = coverageMap.files();
      const uncoveredCoverage = await this.getCoverageMapForUncoveredFiles(coveredFiles);
      coverageMap.merge(await transformCoverage(uncoveredCoverage));
    }
    const context = libReport.createContext({
      dir: this.options.reportsDirectory,
      coverageMap,
      watermarks: this.options.watermarks
    });
    if (this.hasTerminalReporter(this.options.reporter))
      this.ctx.logger.log(c.blue(" % ") + c.dim("Coverage report from ") + c.yellow(this.name));
    for (const reporter of this.options.reporter) {
      reports.create(reporter[0], {
        skipFull: this.options.skipFull,
        projectRoot: this.ctx.config.root,
        ...reporter[1]
      }).execute(context);
    }
    if (this.options.thresholds) {
      const resolvedThresholds = this.resolveThresholds({
        coverageMap,
        thresholds: this.options.thresholds,
        createCoverageMap: () => libCoverage.createCoverageMap({})
      });
      this.checkThresholds({
        thresholds: resolvedThresholds,
        perFile: this.options.thresholds.perFile
      });
      if (this.options.thresholds.autoUpdate && allTestsRun) {
        if (!this.ctx.server.config.configFile)
          throw new Error('Missing configurationFile. The "coverage.thresholds.autoUpdate" can only be enabled when configuration file is used.');
        const configFilePath = this.ctx.server.config.configFile;
        const configModule = parseModule(await promises.readFile(configFilePath, "utf8"));
        this.updateThresholds({
          thresholds: resolvedThresholds,
          perFile: this.options.thresholds.perFile,
          configurationFile: configModule,
          onUpdate: () => writeFileSync(configFilePath, configModule.generate().code, "utf-8")
        });
      }
    }
    await promises.rm(this.coverageFilesDirectory, { recursive: true });
    this.coverageFiles = /* @__PURE__ */ new Map();
  }
  async getCoverageMapForUncoveredFiles(coveredFiles) {
    const allFiles = await this.testExclude.glob(this.ctx.config.root);
    let includedFiles = allFiles.map((file) => resolve(this.ctx.config.root, file));
    if (this.ctx.config.changed)
      includedFiles = (this.ctx.config.related || []).filter((file) => includedFiles.includes(file));
    const uncoveredFiles = includedFiles.filter((file) => !coveredFiles.includes(file));
    const cacheKey = (/* @__PURE__ */ new Date()).getTime();
    const coverageMap = libCoverage.createCoverageMap({});
    for (const [index, filename] of uncoveredFiles.entries()) {
      debug("Uncovered file %s %d/%d", filename, index, uncoveredFiles.length);
      await this.ctx.vitenode.transformRequest(`${filename}?v=${cacheKey}`);
      const lastCoverage = this.instrumenter.lastFileCoverage();
      coverageMap.addFileCoverage(lastCoverage);
    }
    return coverageMap;
  }
}
async function transformCoverage(coverageMap) {
  includeImplicitElseBranches(coverageMap);
  const sourceMapStore = libSourceMaps.createSourceMapStore();
  return await sourceMapStore.transformCoverage(coverageMap);
}
function removeQueryParameters(filename) {
  return filename.split("?")[0];
}
function includeImplicitElseBranches(coverageMap) {
  for (const file of coverageMap.files()) {
    const fileCoverage = coverageMap.fileCoverageFor(file);
    for (const branchMap of Object.values(fileCoverage.branchMap)) {
      if (branchMap.type === "if") {
        const lastIndex = branchMap.locations.length - 1;
        if (lastIndex > 0) {
          const elseLocation = branchMap.locations[lastIndex];
          if (elseLocation && isEmptyCoverageRange(elseLocation)) {
            const ifLocation = branchMap.locations[0];
            elseLocation.start = { ...ifLocation.start };
            elseLocation.end = { ...ifLocation.end };
          }
        }
      }
    }
  }
}
function isEmptyCoverageRange(range) {
  return range.start === void 0 || range.start.line === void 0 || range.start.column === void 0 || range.end === void 0 || range.end.line === void 0 || range.end.column === void 0;
}

export { IstanbulCoverageProvider };