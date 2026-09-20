// End-to-end smoke test in a separate Brave profile. No changes to the user's profile.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn, execFileSync } = require("node:child_process");

const extension = path.resolve(__dirname, "..", "extension");
const brave = process.env.BRAVE_BINARY || "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function rssMiB(rootPid) {
  const output = execFileSync("ps", ["-axo", "pid=,ppid=,rss="], { encoding: "utf8" });
  const rows = output.trim().split("\n").map(line => line.trim().split(/\s+/).map(Number));
  const included = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [pid, ppid] of rows) {
      if (included.has(ppid) && !included.has(pid)) { included.add(pid); changed = true; }
    }
  }
  const kib = rows.filter(([pid]) => included.has(pid)).reduce((sum, row) => sum + row[2], 0);
  return Math.round(kib / 1024);
}

async function until(fn, timeoutMs, description) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await wait(250);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  });
  return {
    close: () => ws.close(),
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    async evaluate(expression) {
      const response = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
      return response.result.value;
    }
  };
}

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "standby-e2e-"));
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end('<!doctype html><title>Memory test</title><script>window.payload=new Uint8Array(128*1024*1024);for(let i=0;i<window.payload.length;i+=4096)window.payload[i]=1</script>Loaded');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  let browser;
  let cdp;
  try {
    browser = spawn(brave, [
      "--headless=new", "--no-first-run", "--no-default-browser-check",
      "--remote-debugging-port=0", `--user-data-dir=${profile}`,
      `--disable-extensions-except=${extension}`, `--load-extension=${extension}`,
      "about:blank"
    ], { stdio: "ignore" });
    const portFile = path.join(profile, "DevToolsActivePort");
    const debugPort = await until(() => fs.existsSync(portFile) && fs.readFileSync(portFile, "utf8").split("\n")[0], 15000, "Brave debugging port");
    const worker = await until(async () => {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const targets = await response.json();
      return targets.find(target => target.type === "service_worker" && target.url.endsWith("/background.js"));
    }, 15000, "extension service worker");
    cdp = await connect(worker.webSocketDebuggerUrl);
    const active = await cdp.evaluate(`chrome.tabs.create({url:'http://127.0.0.1:${port}/active',active:true})`);
    const idle = await cdp.evaluate(`chrome.tabs.create({url:'http://127.0.0.1:${port}/idle',active:false,pinned:true})`);
    assert.ok(active.id && idle.id);
    await until(async () => (await cdp.evaluate(`chrome.tabs.get(${idle.id})`)).status === "complete", 15000, "test tab load");
    await cdp.evaluate("chrome.storage.local.set({settings:{enabled:true,delayMinutes:0.5,includePinned:true,skipAudible:true,exceptions:[]}})");
    const before = rssMiB(browser.pid);
    const idleUrl = `http://127.0.0.1:${port}/idle`;
    const state = await until(async () => {
      const all = await cdp.evaluate("chrome.tabs.query({})");
      const tab = all.find(item => item.url === idleUrl);
      if (!tab) throw new Error(`Test tab disappeared: ${JSON.stringify(all.map(item => ({ id: item.id, url: item.url })))}`);
      return tab.discarded ? tab : false;
    }, 70000, "automatic tab discard");
    const after = rssMiB(browser.pid);
    assert.equal(state.pinned, true);
    assert.equal(state.url, idleUrl);
    assert.equal((await cdp.evaluate(`chrome.tabs.get(${active.id})`)).discarded, false);
    console.log(JSON.stringify({ beforeMiB: before, afterMiB: after, deltaMiB: before - after, idleDiscarded: true, pinnedPreserved: true, tabIdChanged: state.id !== idle.id }));
    assert.ok(before > after, "Brave RSS should fall after discarding the 128 MiB test tab");
    await cdp.evaluate(`chrome.tabs.update(${state.id},{active:true})`);
    await until(async () => {
      const all = await cdp.evaluate("chrome.tabs.query({})");
      return all.find(item => item.url === idleUrl && item.active && !item.discarded);
    }, 15000, "tab reload on activation");
    console.log("Brave end-to-end test: OK");
  } finally {
    cdp?.close();
    browser?.kill("SIGTERM");
    await wait(400);
    server.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
