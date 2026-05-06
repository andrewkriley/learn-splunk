#!/usr/bin/env python3
"""Generate JSON or XML file events for the Splunk forwarding lab."""

from __future__ import annotations

import json
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape


SOURCES = ("checkout", "inventory", "identity", "notifications")
LEVELS = ("INFO", "INFO", "WARN", "ERROR")


def timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "+0000"


def build_payload(format_name: str) -> dict[str, object]:
    return {
        "ts": timestamp(),
        "source": random.choice(SOURCES),
        "format": format_name,
        "level": random.choice(LEVELS),
        "duration_ms": random.randint(25, 1800),
        "request_id": f"structured-{random.randint(100000, 999999)}",
    }


def build_json_event() -> str:
    return json.dumps(build_payload("json"), separators=(",", ":")) + "\n"


def build_xml_event() -> str:
    payload = build_payload("xml")
    attributes = " ".join(f'{key}="{escape(str(value))}"' for key, value in payload.items())
    return f"<event {attributes} />\n"


def main() -> int:
    if len(sys.argv) != 3 or sys.argv[1] not in {"json", "xml"}:
        print("usage: generate_structured_file_events.py <json|xml> /path/to/output", file=sys.stderr)
        return 2

    format_name = sys.argv[1]
    output_path = Path(sys.argv[2])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    builder = build_json_event if format_name == "json" else build_xml_event

    while True:
        with output_path.open("a", encoding="utf-8") as handle:
            handle.write(builder())
            handle.flush()
        time.sleep(3)


if __name__ == "__main__":
    raise SystemExit(main())

