#!/usr/bin/env python3
"""Generate simple application logs for the Splunk forwarding lab."""

from __future__ import annotations

import json
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


LEVELS = ("INFO", "INFO", "INFO", "WARN", "ERROR")
ACTIONS = ("login", "search", "checkout", "api_call", "download", "logout")
USERS = ("alice", "bob", "charlie", "dana", "eve")


def build_event() -> str:
    payload = {
        "level": random.choice(LEVELS),
        "action": random.choice(ACTIONS),
        "user": random.choice(USERS),
        "duration_ms": random.randint(10, 2500),
        "request_id": f"req-{random.randint(100000, 999999)}",
    }
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "+0000"
    return f"ts={timestamp} app=demo_service event={json.dumps(payload, separators=(',', ':'))}\n"


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: generate_logs.py /path/to/app.log", file=sys.stderr)
        return 2

    log_path = Path(sys.argv[1])
    log_path.parent.mkdir(parents=True, exist_ok=True)

    while True:
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(build_event())
            handle.flush()
        time.sleep(2)


if __name__ == "__main__":
    raise SystemExit(main())

