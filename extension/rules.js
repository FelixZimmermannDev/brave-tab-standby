const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,
  delayMinutes: 5,
  includePinned: true,
  skipAudible: true,
  exceptions: []
});

function normalizeSettings(raw = {}) {
  const delay = Number(raw.delayMinutes);
  return {
    enabled: raw.enabled === true,
    delayMinutes: [0.5, 1, 5, 15, 30].includes(delay) ? delay : 5,
    includePinned: raw.includePinned !== false,
    skipAudible: raw.skipAudible !== false,
    exceptions: Array.isArray(raw.exceptions)
      ? raw.exceptions.filter(item => typeof item === "string").map(item => item.trim().toLowerCase()).filter(Boolean)
      : []
  };
}

function isWebUrl(url) {
  return /^https?:\/\//i.test(url || "");
}

function matchesException(url, exceptions) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return exceptions.some(entry => hostname === entry || hostname.endsWith(`.${entry}`));
  } catch {
    return false;
  }
}

function isEligible(tab, settings) {
  return Boolean(
    Number.isInteger(tab.id) && !tab.active && !tab.discarded &&
    tab.autoDiscardable !== false && isWebUrl(tab.url) &&
    (settings.includePinned || !tab.pinned) &&
    (!settings.skipAudible || !tab.audible) &&
    !matchesException(tab.url, settings.exceptions)
  );
}

function shouldDiscard(tab, settings, inactiveSince, now) {
  return isEligible(tab, settings) &&
    Number.isFinite(inactiveSince) &&
    now - inactiveSince >= settings.delayMinutes * 60_000;
}

globalThis.StandbyRules = {
  DEFAULT_SETTINGS, normalizeSettings, isEligible, shouldDiscard, matchesException
};

