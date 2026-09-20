# Brave Tab Standby

A small Manifest V3 extension for Brave and Chrome. It discards background tabs after a configurable delay, while leaving their tab, title, and site icon in the tab strip. Opening a discarded tab reloads the page.

The browser extension must use JavaScript because Chrome's extension APIs are JavaScript APIs. This repository is also a Python project: the dependency-free `standby_tool.py` validates, tests, and packages the extension.

## Install locally

**One-click download:** [Download `brave-tab-standby-v0.3.0.zip`](https://github.com/FelixZimmermannDev/brave-tab-standby/releases/download/v0.3.0/brave-tab-standby-v0.3.0.zip)

Do not use GitHub's **Code → Download ZIP** button. That downloads the source repository as `brave-tab-standby-main.zip`; its `manifest.json` is inside the `extension` folder and it is not the packaged install file.

Or download and extract it from a terminal:

```sh
curl -fL -o brave-tab-standby-v0.3.0.zip 'https://github.com/FelixZimmermannDev/brave-tab-standby/releases/download/v0.3.0/brave-tab-standby-v0.3.0.zip'
unzip brave-tab-standby-v0.3.0.zip -d brave-tab-standby-v0.3.0-extension
```

Then install it in Brave:

1. Extract the ZIP if you downloaded it by clicking the link. Keep the extracted folder; it must contain `manifest.json` directly.
2. Open `brave://extensions` (or `chrome://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
5. Click the extension icon, enable **Automatic standby**, choose a delay, and click **Save settings**. The default delay is five minutes.

If you clone this repository instead, select its `extension` folder in step 4. Do not select the ZIP file itself; Brave needs the extracted folder.

The extension starts paused until you enable it. Choose **Instantly** to process all already-open eligible background tabs as soon as you save the setting; otherwise select a delay from 30 seconds to 30 minutes. Pinned tabs are included by default. Audible tabs, browser internal pages, sites in the exception list, and individually protected tabs are skipped. Use **Keep current tab awake** in the popup to protect one exact tab; the exception is saved locally and can be removed there. A manual **Discard inactive tabs now** button helps you test it.

## Python harness

Requires Python 3.10+ and Node.js 18+; no packages to install.

```sh
python3 standby_tool.py check
python3 standby_tool.py test
python3 standby_tool.py browser-test
python3 standby_tool.py package
```

The last command writes a ZIP to `dist/` for local sharing and prints its SHA-256 checksum. Packaging verifies that the Python project and extension use the same version. The Python test harness runs the JavaScript scheduler against a fake browser API, including instant and delayed standby, tab switching, pinned tabs, site and individual-tab exceptions, subdomain matching, audio, and reactivation.

## Release checklist

1. Update the version in `extension/manifest.json`, `pyproject.toml`, and the two versioned links above.
2. Run `python3 standby_tool.py test` and `python3 standby_tool.py package`.
3. Create a GitHub release with tag `v<version>` and upload the versioned file `dist/brave-tab-standby-v<version>.zip`.

`browser-test` launches an isolated headless Brave profile (macOS default path; override with `BRAVE_BINARY`), loads the unpacked extension, opens a 128 MiB test page, waits for automatic discard, and compares the browser process tree's RSS before and after. It then confirms that activating the tab reloads it. RSS is an approximate process metric; results vary with caching and shared memory.

On the initial Mac test machine, two isolated runs reduced summed Brave-process RSS by 518 MiB and 505 MiB after the pinned test tab was discarded. These are test-page results, not a prediction for ordinary sites or an installed user profile.

## Limits

Chrome's `tabs.discard()` keeps a tab visible and reloads it on return. It cannot guarantee every site's own favicon is drawn while unloaded, nor can an extension terminate a specific process from Brave Task Manager. Some pages may refuse discarding. Unsubmitted form fields, live sessions, and in-page state may be lost when reloaded. The extension never reads page contents or sends data over the network.

## References

- [Chrome tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [Chrome alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms)
- [Chrome Manifest V3](https://developer.chrome.com/docs/extensions/reference/manifest)
