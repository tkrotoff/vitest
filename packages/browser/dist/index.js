import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import sirv from 'sirv';
import { coverageConfigDefaults } from 'vitest/config';
import MagicString from 'magic-string';
import { esmWalker } from '@vitest/utils/ast';

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
const basename = function(p, extension) {
  const lastSegment = normalizeWindowsPath(p).split("/").pop();
  return extension && lastSegment.endsWith(extension) ? lastSegment.slice(0, -extension.length) : lastSegment;
};

/**
 * @param {import('estree').Node} param
 * @returns {string[]}
 */
function extract_names(param) {
	return extract_identifiers(param).map((node) => node.name);
}

/**
 * @param {import('estree').Node} param
 * @param {import('estree').Identifier[]} nodes
 * @returns {import('estree').Identifier[]}
 */
function extract_identifiers(param, nodes = []) {
	switch (param.type) {
		case 'Identifier':
			nodes.push(param);
			break;

		case 'MemberExpression':
			let object = param;
			while (object.type === 'MemberExpression') {
				object = /** @type {any} */ (object.object);
			}
			nodes.push(/** @type {any} */ (object));
			break;

		case 'ObjectPattern':
			for (const prop of param.properties) {
				if (prop.type === 'RestElement') {
					extract_identifiers(prop.argument, nodes);
				} else {
					extract_identifiers(prop.value, nodes);
				}
			}

			break;

		case 'ArrayPattern':
			for (const element of param.elements) {
				if (element) extract_identifiers(element, nodes);
			}

			break;

		case 'RestElement':
			extract_identifiers(param.argument, nodes);
			break;

		case 'AssignmentPattern':
			extract_identifiers(param.left, nodes);
			break;
	}

	return nodes;
}

const viInjectedKey = "__vi_inject__";
const viExportAllHelper = "__vitest_browser_runner__.exportAll";
const skipHijack = [
  "/@vite/client",
  "/@vite/env",
  /vite\/dist\/client/
];
function injectVitestModule(code, id, parse) {
  if (skipHijack.some((skip) => id.match(skip)))
    return;
  const s = new MagicString(code);
  let ast;
  try {
    ast = parse(code);
  } catch (err) {
    console.error(`Cannot parse ${id}:
${err.message}`);
    return;
  }
  let uid = 0;
  const idToImportMap = /* @__PURE__ */ new Map();
  const declaredConst = /* @__PURE__ */ new Set();
  const hoistIndex = 0;
  const transformImportDeclaration = (node) => {
    const source = node.source.value;
    if (skipHijack.some((skip) => source.match(skip)))
      return null;
    const importId = `__vi_esm_${uid++}__`;
    const hasSpecifiers = node.specifiers.length > 0;
    const code2 = hasSpecifiers ? `import { ${viInjectedKey} as ${importId} } from '${source}'
` : `import '${source}'
`;
    return {
      code: code2,
      id: importId
    };
  };
  function defineImport(node) {
    const declaration = transformImportDeclaration(node);
    if (!declaration)
      return null;
    s.appendLeft(hoistIndex, declaration.code);
    return declaration.id;
  }
  function defineImportAll(source) {
    const importId = `__vi_esm_${uid++}__`;
    s.appendLeft(hoistIndex, `const { ${viInjectedKey}: ${importId} } = await import(${JSON.stringify(source)});
`);
    return importId;
  }
  function defineExport(position, name, local = name) {
    s.appendLeft(
      position,
      `
Object.defineProperty(${viInjectedKey}, "${name}", { enumerable: true, configurable: true, get(){ return ${local} }});`
    );
  }
  for (const node of ast.body) {
    if (node.type === "ImportDeclaration") {
      const importId = defineImport(node);
      if (!importId)
        continue;
      s.remove(node.start, node.end);
      for (const spec of node.specifiers) {
        if (spec.type === "ImportSpecifier") {
          idToImportMap.set(
            spec.local.name,
            `${importId}.${spec.imported.name}`
          );
        } else if (spec.type === "ImportDefaultSpecifier") {
          idToImportMap.set(spec.local.name, `${importId}.default`);
        } else {
          idToImportMap.set(spec.local.name, importId);
        }
      }
    }
  }
  for (const node of ast.body) {
    if (node.type === "ExportNamedDeclaration") {
      if (node.declaration) {
        if (node.declaration.type === "FunctionDeclaration" || node.declaration.type === "ClassDeclaration") {
          defineExport(node.end, node.declaration.id.name);
        } else {
          for (const declaration of node.declaration.declarations) {
            const names = extract_names(declaration.id);
            for (const name of names)
              defineExport(node.end, name);
          }
        }
        s.remove(node.start, node.declaration.start);
      } else {
        s.remove(node.start, node.end);
        if (node.source) {
          const importId = defineImportAll(node.source.value);
          for (const spec of node.specifiers) {
            defineExport(
              hoistIndex,
              spec.exported.name,
              `${importId}.${spec.local.name}`
            );
          }
        } else {
          for (const spec of node.specifiers) {
            const local = spec.local.name;
            const binding = idToImportMap.get(local);
            defineExport(node.end, spec.exported.name, binding || local);
          }
        }
      }
    }
    if (node.type === "ExportDefaultDeclaration") {
      const expressionTypes = ["FunctionExpression", "ClassExpression"];
      if ("id" in node.declaration && node.declaration.id && !expressionTypes.includes(node.declaration.type)) {
        const { name } = node.declaration.id;
        s.remove(
          node.start,
          node.start + 15
          /* 'export default '.length */
        );
        s.append(
          `
Object.defineProperty(${viInjectedKey}, "default", { enumerable: true, configurable: true, value: ${name} });`
        );
      } else {
        s.update(
          node.start,
          node.start + 14,
          `${viInjectedKey}.default =`
        );
        s.append(`
export default { ${viInjectedKey}: ${viInjectedKey}.default };
`);
      }
    }
    if (node.type === "ExportAllDeclaration") {
      s.remove(node.start, node.end);
      const importId = defineImportAll(node.source.value);
      if (node.exported)
        defineExport(hoistIndex, node.exported.name, `${importId}`);
      else
        s.appendLeft(hoistIndex, `${viExportAllHelper}(${viInjectedKey}, ${importId});
`);
    }
  }
  esmWalker(ast, {
    onIdentifier(id2, info, parentStack) {
      const binding = idToImportMap.get(id2.name);
      if (!binding)
        return;
      if (info.hasBindingShortcut) {
        s.appendLeft(id2.end, `: ${binding}`);
      } else if (info.classDeclaration) {
        if (!declaredConst.has(id2.name)) {
          declaredConst.add(id2.name);
          const topNode = parentStack[parentStack.length - 2];
          s.prependRight(topNode.start, `const ${id2.name} = ${binding};
`);
        }
      } else if (
        // don't transform class name identifier
        !info.classExpression
      ) {
        s.update(id2.start, id2.end, binding);
      }
    },
    // TODO: make env updatable
    onImportMeta() {
    },
    onDynamicImport(node) {
      const replace = "__vitest_browser_runner__.wrapModule(import(";
      s.overwrite(node.start, node.source.start, replace);
      s.overwrite(node.end - 1, node.end, "))");
    }
  });
  s.prepend(`const ${viInjectedKey} = { [Symbol.toStringTag]: "Module" };
`);
  s.append(`
export { ${viInjectedKey} }`);
  return {
    ast,
    code: s.toString(),
    map: s.generateMap({ hires: "boundary", source: id })
  };
}

function replacer(code, values) {
  return code.replace(/{\s*(\w+)\s*}/g, (_, key) => values[key] ?? "");
}
var index = (project, base = "/") => {
  const pkgRoot = resolve(fileURLToPath(import.meta.url), "../..");
  const distRoot = resolve(pkgRoot, "dist");
  return [
    {
      enforce: "pre",
      name: "vitest:browser",
      async config(viteConfig) {
        // Enables using ignore hint for coverage providers with @preserve keyword
        if (viteConfig.esbuild !== false) {
          viteConfig.esbuild ||= {};
          viteConfig.esbuild.legalComments = "inline";
        }
      },
      async configureServer(server) {
        const testerHtml = readFile(resolve(distRoot, "client/tester.html"), "utf8");
        const runnerHtml = readFile(resolve(distRoot, "client/index.html"), "utf8");
        const injectorJs = readFile(resolve(distRoot, "client/esm-client-injector.js"), "utf8");
        const favicon = `${base}favicon.svg`;
        const testerPrefix = `${base}__vitest_test__/__test__/`;
        server.middlewares.use((_req, res, next) => {
          const headers = server.config.server.headers;
          if (headers) {
            for (const name in headers)
              res.setHeader(name, headers[name]);
          }
          next();
        });
        server.middlewares.use(async (req, res, next) => {
          if (!req.url)
            return next();
          const url = new URL(req.url, "http://localhost");
          if (!url.pathname.startsWith(testerPrefix) && url.pathname !== base)
            return next();
          res.setHeader("Cache-Control", "no-cache, max-age=0, must-revalidate");
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          const files = project.browserState?.files ?? [];
          const config = wrapConfig(project.getSerializableConfig());
          config.env ??= {};
          config.env.VITEST_BROWSER_DEBUG = process.env.VITEST_BROWSER_DEBUG || "";
          const injector = replacer(await injectorJs, {
            __VITEST_CONFIG__: JSON.stringify(config),
            __VITEST_FILES__: JSON.stringify(files)
          });
          if (url.pathname === base) {
            const html2 = replacer(await runnerHtml, {
              __VITEST_FAVICON__: favicon,
              __VITEST_TITLE__: "Vitest Browser Runner",
              __VITEST_INJECTOR__: injector
            });
            res.write(html2, "utf-8");
            res.end();
            return;
          }
          const decodedTestFile = decodeURIComponent(url.pathname.slice(testerPrefix.length));
          const tests = decodedTestFile === "__vitest_all__" || !files.includes(decodedTestFile) ? "__vitest_browser_runner__.files" : JSON.stringify([decodedTestFile]);
          const html = replacer(await testerHtml, {
            __VITEST_FAVICON__: favicon,
            __VITEST_TITLE__: "Vitest Browser Tester",
            __VITEST_INJECTOR__: injector,
            __VITEST_APPEND__: (
              // TODO: have only a single global variable to not pollute the global scope
              `<script type="module">
  __vitest_browser_runner__.runningFiles = ${tests}
  __vitest_browser_runner__.runTests(__vitest_browser_runner__.runningFiles)
<\/script>`
            )
          });
          res.write(html, "utf-8");
          res.end();
        });
        server.middlewares.use(
          base,
          sirv(resolve(distRoot, "client"), {
            single: false,
            dev: true
          })
        );
        const coverageFolder = resolveCoverageFolder(project);
        const coveragePath = coverageFolder ? coverageFolder[1] : void 0;
        if (coveragePath && base === coveragePath)
          throw new Error(`The ui base path and the coverage path cannot be the same: ${base}, change coverage.reportsDirectory`);
        coverageFolder && server.middlewares.use(coveragePath, sirv(coverageFolder[0], {
          single: true,
          dev: true,
          setHeaders: (res) => {
            res.setHeader("Cache-Control", "public,max-age=0,must-revalidate");
          }
        }));
      }
    },
    {
      name: "vitest:browser:tests",
      enforce: "pre",
      async config() {
        const {
          include,
          exclude,
          includeSource,
          dir,
          root
        } = project.config;
        const projectRoot = dir || root;
        const entries = await project.globAllTestFiles(include, exclude, includeSource, projectRoot);
        return {
          optimizeDeps: {
            entries: [
              ...entries,
              "vitest",
              "vitest/utils",
              "vitest/browser",
              "vitest/runners",
              "@vitest/utils"
            ],
            exclude: [
              "vitest",
              "vitest/utils",
              "vitest/browser",
              "vitest/runners",
              "@vitest/utils",
              // loupe is manually transformed
              "loupe"
            ],
            include: [
              "vitest > @vitest/utils > pretty-format",
              "vitest > @vitest/snapshot > pretty-format",
              "vitest > @vitest/snapshot > magic-string",
              "vitest > diff-sequences",
              "vitest > pretty-format",
              "vitest > pretty-format > ansi-styles",
              "vitest > pretty-format > ansi-regex",
              "vitest > chai"
            ]
          }
        };
      },
      transform(code, id) {
        if (id.includes("loupe/loupe.js")) {
          const exportsList = ["custom", "inspect", "registerConstructor", "registerStringTag"];
          const codeAppend = exportsList.map((i) => `export const ${i} = globalThis.loupe.${i}`).join("\n");
          return `${code}
${codeAppend}
export default globalThis.loupe`;
        }
      },
      async resolveId(id) {
        if (!/\?browserv=\w+$/.test(id))
          return;
        let useId = id.slice(0, id.lastIndexOf("?"));
        if (useId.startsWith("/@fs/"))
          useId = useId.slice(5);
        if (/^\w:/.test(useId))
          useId = useId.replace(/\\/g, "/");
        return useId;
      }
    },
    {
      name: "vitest:browser:esm-injector",
      enforce: "post",
      transform(source, id) {
        const hijackESM = project.config.browser.slowHijackESM ?? false;
        if (!hijackESM)
          return;
        return injectVitestModule(source, id, this.parse);
      }
    }
  ];
};
function resolveCoverageFolder(project) {
  const options = project.ctx.config;
  const htmlReporter = options.coverage?.enabled ? options.coverage.reporter.find((reporter) => {
    if (typeof reporter === "string")
      return reporter === "html";
    return reporter[0] === "html";
  }) : void 0;
  if (!htmlReporter)
    return void 0;
  const root = resolve(
    options.root || options.root || process.cwd(),
    options.coverage.reportsDirectory || coverageConfigDefaults.reportsDirectory
  );
  const subdir = Array.isArray(htmlReporter) && htmlReporter.length > 1 && "subdir" in htmlReporter[1] ? htmlReporter[1].subdir : void 0;
  if (!subdir || typeof subdir !== "string")
    return [root, `/${basename(root)}/`];
  return [resolve(root, subdir), `/${basename(root)}/${subdir}/`];
}
function wrapConfig(config) {
  return {
    ...config,
    // workaround RegExp serialization
    testNamePattern: config.testNamePattern ? config.testNamePattern.toString() : void 0
  };
}

export { index as default };
