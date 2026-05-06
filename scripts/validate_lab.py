#!/usr/bin/env python3
"""Run lightweight checks against the local Splunk forwarding lab."""

from __future__ import annotations

import base64
import json
import os
import ssl
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPLUNK_MANAGEMENT_URL = os.environ.get("SPLUNK_MANAGEMENT_URL", "https://localhost:8089")
REQUIRED_SERVICES = {
    "splunk-indexer",
    "deployment-server",
    "heavy-forwarder",
    "universal-forwarder",
    "universal-forwarder-via-heavy",
    "sample-log-source",
    "sample-log-source-via-heavy",
    "tcp-udp-source-direct",
    "tcp-udp-source-via-heavy",
    "structured-json-source",
    "structured-xml-source",
    "masked-pii-source",
    "http-event-collector-source",
}
EXPECTED_INDEX_SOURCETYPES = {
    "lab_file": {"lab:app"},
    "lab_tcp": {"lab:tcp"},
    "lab_udp": {"lab:udp"},
    "lab_json": {"lab:json"},
    "lab_xml": {"lab:xml"},
    "lab_hec": {"lab:hec"},
    "lab_scripted": {"lab:scripted:python", "lab:scripted:bash"},
    "lab_masked": {"lab:masked"},
}


def load_env() -> dict[str, str]:
    env = dict(os.environ)
    env_file = ROOT / ".env"
    if not env_file.exists():
        return env

    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env.setdefault(key, value)
    return env


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def check_compose_services() -> bool:
    result = run(["docker", "compose", "ps", "--services", "--filter", "status=running"])
    if result.returncode != 0:
        print("FAIL docker compose is not running or unavailable")
        print(result.stderr.strip())
        return False

    running = set(result.stdout.split())
    missing = REQUIRED_SERVICES - running
    if missing:
        print(f"FAIL missing running services: {', '.join(sorted(missing))}")
        return False

    print("PASS all expected Docker services are running")
    return True


def splunk_request(path: str, password: str, data: dict[str, str] | None = None) -> tuple[int, str]:
    url = f"{SPLUNK_MANAGEMENT_URL.rstrip('/')}{path}"
    encoded_data = None
    if data is not None:
        encoded_data = urllib.parse.urlencode(data).encode("utf-8")

    request = urllib.request.Request(url, data=encoded_data)
    token = base64.b64encode(f"admin:{password}".encode("utf-8")).decode("ascii")
    request.add_header("Authorization", f"Basic {token}")
    context = ssl._create_unverified_context()

    with urllib.request.urlopen(request, context=context, timeout=20) as response:
        body = response.read().decode("utf-8", errors="replace")
        return response.status, body


def check_splunk_management(password: str) -> bool:
    try:
        status, _ = splunk_request("/services/server/info?output_mode=json", password)
    except Exception as exc:
        print(f"FAIL Splunk management API is not ready: {exc}")
        return False

    if status != 200:
        print(f"FAIL Splunk management API returned HTTP {status}")
        return False

    print("PASS indexer management API is ready")
    return True


def check_lab_events(password: str) -> bool:
    indexes = ", ".join(EXPECTED_INDEX_SOURCETYPES)
    search = f"search index IN ({indexes}) | stats count by index sourcetype"
    try:
        _, body = splunk_request(
            "/services/search/jobs/export",
            password,
            {"search": search, "output_mode": "json"},
        )
    except Exception as exc:
        print(f"FAIL search could not run yet: {exc}")
        return False

    found: set[tuple[str, str]] = set()
    for line in body.splitlines():
        if not line.strip():
            continue
        event = json.loads(line)
        result = event.get("result")
        if result and int(result.get("count", "0")) > 0:
            found.add((result.get("index", ""), result.get("sourcetype", "")))

    required = {
        (index, sourcetype)
        for index, sourcetypes in EXPECTED_INDEX_SOURCETYPES.items()
        for sourcetype in sourcetypes
    }
    missing = required - found
    if not missing:
        print("PASS all lab data source indexes and sourcetypes are searchable")
        return True

    formatted = ", ".join(f"{index}/{sourcetype}" for index, sourcetype in sorted(missing))
    print(f"FAIL missing lab index/sourcetype pairs: {formatted}")
    return False


def main() -> int:
    env = load_env()
    password = env.get("SPLUNK_PASSWORD", "")
    if not password or password == "change-this-local-lab-password":
        print("FAIL set SPLUNK_PASSWORD in .env before validating")
        return 1

    checks = [check_compose_services()]
    if checks[-1]:
        checks.append(check_splunk_management(password))
    if checks[-1]:
        time.sleep(1)
        checks.append(check_lab_events(password))

    return 0 if all(checks) else 1


if __name__ == "__main__":
    raise SystemExit(main())

