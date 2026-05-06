#!/usr/bin/env python3
"""Show Splunk deployment-server apps and deployable config files."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SERVERCLASS = ROOT / "splunk/deployment-server/serverclass.conf"
DEPLOYMENT_APPS = ROOT / "splunk/deployment-apps"


def print_file(path: Path) -> None:
    relative = path.relative_to(ROOT)
    print(f"--- {relative} ---")
    print(path.read_text(encoding="utf-8").rstrip())
    print()


def main() -> int:
    print("Deployment server deployable configurations and apps")
    print()
    print_file(SERVERCLASS)

    for app_dir in sorted(DEPLOYMENT_APPS.iterdir()):
        if not app_dir.is_dir() or app_dir.name.startswith("_") or app_dir.name == "README":
            continue

        print(f"=== app: {app_dir.name} ===")
        config_files = sorted(app_dir.glob("default/*.conf"))
        if not config_files:
            print("no default/*.conf files")
            print()
        for config_file in config_files:
            print_file(config_file)

        bin_dir = app_dir / "bin"
        if bin_dir.exists():
            scripts = sorted(path.name for path in bin_dir.iterdir() if path.is_file())
            if scripts:
                print("deployable scripts:")
                for script in scripts:
                    print(f"- {script}")
                print()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

