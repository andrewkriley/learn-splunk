#!/usr/bin/env python3
"""Generate OpenTelemetry-style JSON events for the Learn Splunk lab."""

from __future__ import annotations

import json
import random
import secrets
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


SERVICES = ("checkout-api", "inventory-api", "payment-worker", "frontend-web")
SEVERITIES = ("INFO", "INFO", "WARN", "ERROR")
SPAN_NAMES = ("GET /checkout", "POST /cart", "GET /inventory", "POST /payment")


def timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "+0000"


def unix_nano() -> str:
    return str(time.time_ns())


def build_event() -> str:
    service = random.choice(SERVICES)
    severity = random.choice(SEVERITIES)
    duration_ms = random.randint(15, 2500)
    status_code = "ERROR" if severity == "ERROR" else "OK"

    event = {
        "ts": timestamp(),
        "source": "open-telemetry-source",
        "telemetry_type": "log",
        "trace_id": secrets.token_hex(16),
        "span_id": secrets.token_hex(8),
        "time_unix_nano": unix_nano(),
        "observed_time_unix_nano": unix_nano(),
        "severity_text": severity,
        "body": f"{service} handled {random.choice(SPAN_NAMES)}",
        "resource": {
            "service.name": service,
            "service.namespace": "learn-splunk",
            "deployment.environment": "local-lab",
        },
        "scope": {
            "name": "learn-splunk.otel.generator",
            "version": "1.0.0",
        },
        "attributes": {
            "http.method": random.choice(("GET", "POST")),
            "http.status_code": random.choice((200, 200, 201, 404, 500)),
            "span.name": random.choice(SPAN_NAMES),
            "span.status": status_code,
            "duration_ms": duration_ms,
        },
    }
    return json.dumps(event, separators=(",", ":")) + "\n"


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: generate_otel_events.py /path/to/otel.json", file=sys.stderr)
        return 2

    output_path = Path(sys.argv[1])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    while True:
        with output_path.open("a", encoding="utf-8") as handle:
            handle.write(build_event())
            handle.flush()
        time.sleep(3)


if __name__ == "__main__":
    raise SystemExit(main())
