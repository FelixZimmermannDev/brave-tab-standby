# Brave Tab Standby

Brave Tab Standby v0.5.0 frees RAM by unloading inactive browser tabs. The tab stays visible; opening it reloads the page.

## Download and install

[Download v0.5.0](https://github.com/FelixZimmermannDev/brave-tab-standby/releases/download/v0.5.0/brave-tab-standby-v0.5.0.zip)

The ZIP is always named after its release version: `brave-tab-standby-v0.5.0.zip`. Extract it into the equally versioned folder `brave-tab-standby-v0.5.0-extension` and select that folder in Brave.

1. Extract the ZIP.
2. Open `brave://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the extracted folder containing `manifest.json`.

Do not use GitHub's **Code → Download ZIP** button. That is source code, not the install package.

## Use

Open the blue percent-arrow icon in the browser toolbar. Enable **Automatic standby**, choose a delay, then save.

- **Instantly** unloads eligible background tabs as soon as you leave them.
- **Discard inactive tabs now** runs the same action manually.
- Active, protected, excepted, internal, and optionally audible tabs stay loaded.

## Update

Each release has a new versioned ZIP. Download the newest release, extract it, then reload or re-add its folder in `brave://extensions`.

For development, clone the repository and update it with:

```sh
git pull origin main
```

Then click **Reload** for the local extension in `brave://extensions`.

## Development

```sh
python3 standby_tool.py test
python3 standby_tool.py browser-test
python3 standby_tool.py package
```

The test and package commands verify that the manifest, icon assets, package version, and README download URL all use the same version.
