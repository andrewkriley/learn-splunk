#!/usr/bin/env python3
"""Generate PII-bearing events for the HF masking lesson."""

from __future__ import annotations

import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


USERS = (
    ("alice", "alice@example.com", "4111111111111111"),
    ("bob", "bob@example.net", "5555555555554444"),
    ("charlie", "charlie@example.org", "378282246310005"),
)
ACTIONS = ("purchase", "profile_update", "support_case", "password_reset")


def timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "+0000"


def build_event() -> str:
    user, email, card = random.choice(USERS)
    return (
        f"ts={timestamp()} app=pii_demo action={random.choice(ACTIONS)} "
        f"user={user} email={email} card={card} "
        f"request_id=pii-{random.randint(100000, 999999)}\n"
    )


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: generate_pii_events.py /path/to/pii.log", file=sys.stderr)
        return 2

    log_path = Path(sys.argv[1])
    log_path.parent.mkdir(parents=True, exist_ok=True)
    while True:
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(build_event())
            handle.flush()
        time.sleep(3)


if __name__ == "__main__":
    raise SystemExit(main())
