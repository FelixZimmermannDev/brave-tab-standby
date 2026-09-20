importScripts("rules.js");

const ALARM_NAME = "standby-sweep";
const STATE_KEY = "inactiveSince";
const rules = StandbyRules;
let queue = Promise.resolve();

function serialized(task) {
  const next = queue.then(task);
  queue = next.catch(error => console.error("Tab Standby:", error));
  return next;
}

async function settings() {
  const data = await chrome.storage.local.get("settings");
  return rules.normalizeSettings(data.settings);
}

async function ensureAlarm() {
  if (!(await chrome.alarms.get(ALARM_NAME))) {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.5 });
  }
}

async function sweep({ force = false } = {}) {
  const config = await settings();
  const tabs = await chrome.tabs.query({});
  const stored = await chrome.storage.session.get(STATE_KEY);
  const previous = stored[STATE_KEY] || {};
  const next = {};
  const now = Date.now();
  let discarded = 0;

  if (!config.enabled && !force) {
    await chrome.storage.session.set({ [STATE_KEY]: {} });
    return { discarded: 0, eligible: 0 };
  }

  for (const tab of tabs) {
    if (!rules.isEligible(tab, config)) continue;
    const key = String(tab.id);
    const since = Number.isFinite(previous[key]) ? previous[key] : now;
    if ((config.enabled || force) && (force || rules.shouldDiscard(tab, config, since, now))) {
      try {
        const result = await chrome.tabs.discard(tab.id);
        if (result?.discarded) {
          discarded++;
          continue;
        }
      } catch (error) {
        console.debug("Could not discard tab", tab.id, error);
      }
    }
    next[key] = since;
  }

  await chrome.storage.session.set({ [STATE_KEY]: next });
  return { discarded, eligible: Object.keys(next).length };
}

chrome.runtime.onInstalled.addListener(() => {
  serialized(async () => {
    await ensureAlarm();
    await sweep();
  });
});

chrome.runtime.onStartup.addListener(() => {
  serialized(async () => {
    await ensureAlarm();
    await sweep();
  });
});

chrome.tabs.onActivated.addListener(() => serialized(() => sweep()));
chrome.tabs.onCreated.addListener(() => serialized(() => sweep()));
chrome.tabs.onRemoved.addListener(() => serialized(() => sweep()));
chrome.tabs.onUpdated.addListener((_id, changes) => {
  if (changes.url) serialized(() => sweep());
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NAME) serialized(() => sweep());
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) serialized(() => sweep());
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "discard-now" && message?.type !== "status") return false;
  serialized(async () => {
    await ensureAlarm();
    return sweep({ force: message.type === "discard-now" });
  }).then(sendResponse, error => sendResponse({ error: String(error) }));
  return true;
});

ensureAlarm().catch(error => console.error("Tab Standby alarm:", error));
