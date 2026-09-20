const byId = id => document.getElementById(id);
let currentTab;

function tabLabel(item, liveTabs) {
  const live = liveTabs.find(tab => tab.id === item.id);
  return live?.title || item.title || live?.url || item.url || `Tab ${item.id}`;
}

function renderTabExceptions(items, liveTabs) {
  const container = byId("tabExceptions");
  container.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("span");
    empty.className = "empty";
    empty.textContent = "No individual tab exceptions.";
    container.append(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "tab-exception";
    const label = document.createElement("span");
    label.textContent = tabLabel(item, liveTabs);
    label.title = item.url || "";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-tab";
    remove.textContent = "Remove";
    remove.dataset.tabId = String(item.id);
    row.append(label, remove);
    container.append(row);
  }
}

async function load() {
  const [{ settings }, liveTabs, [activeTab]] = await Promise.all([
    chrome.storage.local.get("settings"),
    chrome.tabs.query({}),
    chrome.tabs.query({ active: true, currentWindow: true })
  ]);
  currentTab = activeTab;
  const config = StandbyRules.normalizeSettings(settings);
  byId("enabled").checked = config.enabled;
  byId("delay").value = String(config.delayMinutes);
  byId("includePinned").checked = config.includePinned;
  byId("skipAudible").checked = config.skipAudible;
  byId("exceptions").value = config.exceptions.join("\n");
  renderTabExceptions(config.tabExceptions, liveTabs);
}

async function saveSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  const current = StandbyRules.normalizeSettings(settings);
  await chrome.storage.local.set({ settings: {
    enabled: byId("enabled").checked,
    delayMinutes: Number(byId("delay").value),
    includePinned: byId("includePinned").checked,
    skipAudible: byId("skipAudible").checked,
    exceptions: byId("exceptions").value.split(/\r?\n/).map(line => line.trim().toLowerCase()).filter(Boolean),
    tabExceptions: current.tabExceptions
  } });
}

byId("save").addEventListener("click", async () => {
  const exceptions = byId("exceptions").value.split(/\r?\n/).map(line => line.trim().toLowerCase()).filter(Boolean);
  const invalid = exceptions.find(entry => !/^[a-z0-9.-]+$/.test(entry) || entry.startsWith(".") || entry.endsWith("."));
  if (invalid) {
    byId("status").textContent = `Invalid domain: ${invalid}`;
    return;
  }
  await saveSettings();
  byId("status").textContent = "Saved.";
});

byId("addTabException").addEventListener("click", async () => {
  if (!currentTab?.id) return;
  const { settings } = await chrome.storage.local.get("settings");
  const config = StandbyRules.normalizeSettings(settings);
  if (!config.tabExceptions.some(item => item.id === currentTab.id)) {
    config.tabExceptions.push({ id: currentTab.id, title: currentTab.title || "", url: currentTab.url || "" });
    await chrome.storage.local.set({ settings: { ...config } });
  }
  byId("status").textContent = "Current tab will stay awake.";
  await load();
});

byId("tabExceptions").addEventListener("click", async event => {
  const button = event.target.closest(".remove-tab");
  if (!button) return;
  const { settings } = await chrome.storage.local.get("settings");
  const config = StandbyRules.normalizeSettings(settings);
  config.tabExceptions = config.tabExceptions.filter(item => String(item.id) !== button.dataset.tabId);
  await chrome.storage.local.set({ settings: { ...config } });
  byId("status").textContent = "Tab exception removed.";
  await load();
});

byId("discard").addEventListener("click", async () => {
  byId("status").textContent = "Discarding…";
  try {
    const result = await chrome.runtime.sendMessage({ type: "discard-now" });
    byId("status").textContent = result.error || `Discarded ${result.discarded} tab(s).`;
  } catch (error) {
    byId("status").textContent = String(error);
  }
});

load().catch(error => { byId("status").textContent = String(error); });
