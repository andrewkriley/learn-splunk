#!/usr/bin/env python3
"""Show Learn Splunk MCP connection details and health."""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_HEALTH_URL = "http://localhost:8050/healthz"


def main() -> int:
    health_url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_HEALTH_URL
    config_path = ROOT / ".mcp.json"

    print("Learn Splunk MCP")
    print(f"health_url = {health_url}")
    print("public_endpoint = http://localhost:8050/mcp")
    print()
    print("=" * 80)
    print("PROJECT MCP CONFIG")
    print("=" * 80)
    if config_path.exists():
        print(config_path.read_text(encoding="utf-8").rstrip())
    else:
        print("missing .mcp.json")

    print()
    print("=" * 80)
    print("RUNTIME HEALTH")
    print("=" * 80)
    try:
        with urllib.request.urlopen(health_url, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
            print(json.dumps(payload, indent=2))
            return 0 if payload.get("ok") else 1
    except Exception as exc:
        print(f"status = unreachable")
        print(f"error = {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
