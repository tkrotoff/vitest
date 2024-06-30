import { c as client, g as getConfig, a as getBrowserState, b as channel, r as rpcDone } from "./rpc-wczK3HEm.js";
const url = new URL(location.href);
const ID_ALL = "__vitest_all__";
const iframes = /* @__PURE__ */ new Map();
function debug(...args) {
  const debug2 = getConfig().env.VITEST_BROWSER_DEBUG;
  if (debug2 && debug2 !== "false")
    client.rpc.debug(...args.map(String));
}
function createIframe(container, file) {
  if (iframes.has(file)) {
    container.removeChild(iframes.get(file));
    iframes.delete(file);
  }
  const iframe = document.createElement("iframe");
  iframe.setAttribute("loading", "eager");
  iframe.setAttribute("src", `${url.pathname}__vitest_test__/__test__/${encodeURIComponent(file)}`);
  iframes.set(file, iframe);
  container.appendChild(iframe);
  return iframe;
}
async function done() {
  await rpcDone();
  await client.rpc.finishBrowserTests();
}
client.ws.addEventListener("open", async () => {
  const config = getConfig();
  const container = document.querySelector("#vitest-tester");
  const testFiles = getBrowserState().files;
  debug("test files", testFiles.join(", "));
  if (!testFiles.length) {
    await done();
    return;
  }
  const runningFiles = new Set(testFiles);
  channel.addEventListener("message", async (e) => {
    debug("channel event", JSON.stringify(e.data));
    switch (e.data.type) {
      case "done": {
        const filenames = e.data.filenames;
        filenames.forEach((filename) => runningFiles.delete(filename));
        if (!runningFiles.size)
          await done();
        break;
      }
      case "error": {
        const iframeId = e.data.files.length > 1 ? ID_ALL : e.data.files[0];
        iframes.delete(iframeId);
        await client.rpc.onUnhandledError(e.data.error, e.data.errorType);
        if (iframeId === ID_ALL)
          runningFiles.clear();
        else
          runningFiles.delete(iframeId);
        if (!runningFiles.size)
          await done();
        break;
      }
      default: {
        await client.rpc.onUnhandledError({
          name: "Unexpected Event",
          message: `Unexpected event: ${e.data.type}`
        }, "Unexpected Event");
        await done();
      }
    }
  });
  const fileParallelism = config.browser.fileParallelism ?? config.fileParallelism;
  if (config.isolate === false) {
    createIframe(
      container,
      ID_ALL
    );
  } else {
    if (fileParallelism) {
      for (const file of testFiles) {
        createIframe(
          container,
          file
        );
      }
    } else {
      for (const file of testFiles) {
        createIframe(
          container,
          file
        );
        await new Promise((resolve) => {
          channel.addEventListener("message", function handler(e) {
            if (e.data.type === "done" || e.data.type === "error") {
              channel.removeEventListener("message", handler);
              resolve();
            }
          });
        });
      }
    }
  }
});
