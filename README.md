# Brave Tab Standby

A small Manifest V3 extension for Brave and Chrome. It discards background tabs after a configurable delay, while leaving their tab, title, and site icon in the tab strip. Opening a discarded tab reloads the page.

The browser extension must use JavaScript because Chrome's extension APIs are JavaScript APIs. This repository is also a Python project: the dependency-free `standby_tool.py` validates, tests, and packages the extension.

## Install locally

1. Open `brave://extensions` (or `chrome://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder in this repository.
4. Click the extension icon and enable automatic standby. The default delay is five minutes.

The extension starts paused until you enable it. Pinned tabs are included by default. Audible tabs, browser internal pages, and URLs in your exception list are skipped. A manual **Discard inactive tabs now** button helps you test it.

## Python harness

Requires Python 3.10+ and Node.js 18+; no packages to install.

```sh
python3 standby_tool.py check
python3 standby_tool.py test
python3 standby_tool.py browser-test
python3 standby_tool.py package
```

The last command writes a ZIP to `dist/` for local sharing. The Python test harness runs the JavaScript scheduler against a fake browser API, including tab switching, five-minute delay, pinned tabs, exceptions, audio, and reactivation.

`browser-test` launches an isolated headless Brave profile (macOS default path; override with `BRAVE_BINARY`), loads the unpacked extension, opens a 128 MiB test page, waits for automatic discard, and compares the browser process tree's RSS before and after. It then confirms that activating the tab reloads it. RSS is an approximate process metric; results vary with caching and shared memory.

On the initial Mac test machine, two isolated runs reduced summed Brave-process RSS by 518 MiB and 505 MiB after the pinned test tab was discarded. These are test-page results, not a prediction for ordinary sites or an installed user profile.

## Limits

Chrome's `tabs.discard()` keeps a tab visible and reloads it on return. It cannot guarantee every site's own favicon is drawn while unloaded, nor can an extension terminate a specific process from Brave Task Manager. Some pages may refuse discarding. Unsubmitted form fields, live sessions, and in-page state may be lost when reloaded. The extension never reads page contents or sends data over the network.

## References

- [Chrome tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [Chrome alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms)
- [Chrome Manifest V3](https://developer.chrome.com/docs/extensions/reference/manifest)
