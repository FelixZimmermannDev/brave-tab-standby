const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const extension = path.join(__dirname, "..", "extension");
const listeners = {};
const event = name => ({ addListener(fn) { listeners[name] = fn; } });
let now = 0;
let tabs = [
  { id: 1, url: "https://active.example/", active: true, autoDiscardable: true },
  { id: 2, url: "https://news.example/", active: false, pinned: true, autoDiscardable: true },
  { id: 3, url: "https://music.example/", active: false, audible: true, autoDiscardable: true },
  { id: 4, url: "https://mail.example/", active: false, autoDiscardable: true },
  { id: 5, url: "brave://settings/", active: false, autoDiscardable: true },
  { id: 6, url: "https://dashboard.example/", active: false, autoDiscardable: true }
];
const local = { settings: { enabled: true, delayMinutes: 5, includePinned: true, skipAudible: true, exceptions: ["mail.example"], tabExceptions: [{ id: 6, title: "Pinned dashboard", url: "https://dashboard.example/" }] } };
const session = {};
const alarms = {};
const discarded = [];
const area = store => ({
  async get(key) { return { [key]: store[key] }; },
  async set(value) { Object.assign(store, value); }
});
const chrome = {
  tabs: {
    query: async () => tabs.map(tab => ({ ...tab })),
    discard: async id => {
      const tab = tabs.find(item => item.id === id);
      if (!tab || tab.active || tab.discarded) return undefined;
      tab.discarded = true;
      discarded.push(id);
      return { ...tab };
    },
    onActivated: event("activated"), onCreated: event("created"),
    onRemoved: event("removed"), onUpdated: event("updated")
  },
  alarms: {
    get: async name => alarms[name],
    create: async (name, value) => { alarms[name] = value; },
    onAlarm: event("alarm")
  },
  storage: { local: area(local), session: area(session), onChanged: event("changed") },
  runtime: { onInstalled: event("installed"), onStartup: event("startup"), onMessage: event("message") }
};
const context = vm.createContext({ chrome, console, URL, Date: { now: () => now }, globalThis: null });
context.globalThis = context;
context.importScripts = filename => vm.runInContext(fs.readFileSync(path.join(extension, filename), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(extension, "background.js"), "utf8"), context);

async function tick() {
  listeners.alarm({ name: "standby-sweep" });
  await new Promise(resolve => setImmediate(resolve));
}

(async () => {
  await tick();
  assert.deepEqual(discarded, []);
  now = 299_000;
  await tick();
  assert.deepEqual(discarded, []);
  now = 300_000;
  await tick();
  assert.deepEqual(discarded, [2]);
  assert.equal(tabs[1].url, "https://news.example/");
  assert.equal(tabs[1].discarded, true);
  assert.equal(tabs[2].discarded, undefined, "audible tab stays awake");
  assert.equal(tabs[3].discarded, undefined, "exception stays awake");
  assert.equal(tabs[5].discarded, undefined, "individual tab exception stays awake");

  tabs[0].active = false;
  tabs[1].active = true;
  tabs[1].discarded = false;
  listeners.activated({ tabId: 2, windowId: 1 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(session.inactiveSince["2"], undefined, "activated tab timer removed");
  now = 600_000;
  await tick();
  assert.deepEqual(discarded, [2, 1], "previously active tab discarded after delay");

  local.settings.enabled = false;
  await tick();
  assert.equal(Object.keys(session.inactiveSince).length, 0, "pause clears timers");
  tabs[0].discarded = false;
  now = 1_200_000;
  local.settings.enabled = true;
  await tick();
  assert.equal(tabs[0].discarded, false, "enabling does not discard immediately");
  now = 1_500_000;
  await tick();
  assert.equal(tabs[0].discarded, true, "new countdown starts when enabled");
  const rules = context.StandbyRules;
  assert.equal(rules.normalizeSettings({ delayMinutes: 0 }).delayMinutes, 0, "instant delay is retained");
  assert.equal(rules.shouldDiscard({ id: 9, url: "https://instant.example/", active: false, autoDiscardable: true }, rules.normalizeSettings({ delayMinutes: 0 }), now, now), true, "instant delay discards an existing inactive tab immediately");
  assert.equal(rules.matchesTabException({ id: 6 }, local.settings.tabExceptions), true);
  assert.equal(rules.matchesTabException({ id: 7 }, local.settings.tabExceptions), false);
  assert.equal(rules.isEligible({ id: 8, url: "https://sub.mail.example/path", active: false, autoDiscardable: true }, local.settings), false, "subdomains inherit site exceptions");
  console.log("Scheduler integration tests: OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
