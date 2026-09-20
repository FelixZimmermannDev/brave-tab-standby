const byId = id => document.getElementById(id);

async function load() {
  const { settings } = await chrome.storage.local.get("settings");
  const config = StandbyRules.normalizeSettings(settings);
  byId("enabled").checked = config.enabled;
  byId("delay").value = String(config.delayMinutes);
  byId("includePinned").checked = config.includePinned;
  byId("skipAudible").checked = config.skipAudible;
  byId("exceptions").value = config.exceptions.join("\n");
}

byId("save").addEventListener("click", async () => {
  const exceptions = byId("exceptions").value.split(/\r?\n/).map(line => line.trim().toLowerCase()).filter(Boolean);
  const invalid = exceptions.find(entry => !/^[a-z0-9.-]+$/.test(entry) || entry.startsWith(".") || entry.endsWith("."));
  if (invalid) {
    byId("status").textContent = `Invalid domain: ${invalid}`;
    return;
  }
  await chrome.storage.local.set({ settings: {
    enabled: byId("enabled").checked,
    delayMinutes: Number(byId("delay").value),
    includePinned: byId("includePinned").checked,
    skipAudible: byId("skipAudible").checked,
    exceptions
  } });
  byId("status").textContent = "Saved.";
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

