#!/opt/splunk/bin/python3
"""Emit one Python scripted input event."""

from __future__ import annotations

import json
import random
from datetime import datetime, timezone


timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "+0000"
payload = {
    "language": "python",
    "status": "ok",
    "duration_ms": random.randint(15, 450),
    "request_id": f"scripted-python-{random.randint(100000, 999999)}",
}
print(f"ts={timestamp} scripted_input=python event={json.dumps(payload, separators=(',', ':'))}")

