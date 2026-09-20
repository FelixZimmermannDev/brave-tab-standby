"""Validate, exercise, and package the Brave Tab Standby extension."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXTENSION = ROOT / "extension"
REQUIRED = ("manifest.json", "background.js", "rules.js", "popup.html", "popup.js", "popup.css")


def check() -> None:
    missing = [name for name in REQUIRED if not (EXTENSION / name).is_file()]
    if missing:
        raise ValueError(f"Missing extension files: {', '.join(missing)}")
    manifest = json.loads((EXTENSION / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("manifest_version") != 3:
        raise ValueError("Manifest V3 required")
    if not {"tabs", "alarms", "storage"}.issubset(manifest.get("permissions", [])):
        raise ValueError("tabs, alarms, and storage permissions required")
    if manifest.get("background", {}).get("service_worker") != "background.js":
        raise ValueError("Expected background.js service worker")
    print("Manifest and extension files: OK")


def test() -> None:
    check()
    subprocess.run(["node", "--check", str(EXTENSION / "rules.js")], check=True)
    subprocess.run(["node", "--check", str(EXTENSION / "background.js")], check=True)
    subprocess.run(["node", "--check", str(EXTENSION / "popup.js")], check=True)
    subprocess.run(["node", str(ROOT / "tests" / "scheduler.test.js")], check=True)


def package() -> None:
    check()
    destination = ROOT / "dist" / "brave-tab-standby.zip"
    destination.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in REQUIRED:
            archive.write(EXTENSION / name, name)
    print(destination)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("check", "test", "browser-test", "package"))
    args = parser.parse_args()
    try:
        if args.command == "browser-test":
            test()
            subprocess.run(["node", str(ROOT / "tests" / "browser.test.js")], check=True)
        else:
            {"check": check, "test": test, "package": package}[args.command]()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
