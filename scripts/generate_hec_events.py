#!/usr/bin/env python3
"""Create a lab HEC token at runtime and send HEC events."""

from __future__ import annotations

import base64
import json
import os
import random
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone


TOKEN_NAME = "lab_hec_source"
SOURCETYPE = "lab:hec"
INDEX = "lab_hec"
SOURCES = ("mobile-app", "webhook", "serverless-function", "partner-api")
LEVELS = ("INFO", "INFO", "WARN", "ERROR")


def timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "+0000"


def request(
    url: str,
    *,
    password: str | None = None,
    token: str | None = None,
    data: dict[str, str] | dict[str, object] | None = None,
    json_body: bool = False,
    method: str | None = None,
    timeout: int = 20,
) -> tuple[int, str]:
    body = None
    headers: dict[str, str] = {}
    if data is not None:
        if json_body:
            body = json.dumps(data, separators=(",", ":")).encode("utf-8")
            headers["Content-Type"] = "application/json"
        else:
            body = urllib.parse.urlencode(data).encode("utf-8")

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    if password:
        auth = base64.b64encode(f"admin:{password}".encode("utf-8")).decode("ascii")
        req.add_header("Authorization", f"Basic {auth}")
    if token:
        req.add_header("Authorization", f"Splunk {token}")

    context = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=context, timeout=timeout) as response:
        return response.status, response.read().decode("utf-8", errors="replace")


def get_hec_input(management_url: str, password: str) -> dict[str, object] | None:
    _, body = request(
        f"{management_url}/services/data/inputs/http?output_mode=json",
        password=password,
    )
    payload = json.loads(body)
    for entry in payload.get("entry", []):
        if str(entry.get("name", "")).endswith(TOKEN_NAME):
            return dict(entry.get("content", {}))
    return None


def enable_hec(management_url: str, password: str) -> None:
    request(
        f"{management_url}/services/data/inputs/http/http",
        password=password,
        data={"disabled": "0", "enableSSL": "1", "port": "8088"},
    )


def create_hec_token(management_url: str, password: str) -> str:
    token = uuid.uuid4().hex
    request(
        f"{management_url}/services/data/inputs/http",
        password=password,
        data={
            "name": TOKEN_NAME,
            "index": INDEX,
            "source": "http-event-collector-source",
            "sourcetype": SOURCETYPE,
            "token": token,
            "disabled": "0",
        },
    )
    return token


def delete_hec_token(management_url: str, password: str) -> None:
    request(
        f"{management_url}/services/data/inputs/http/{urllib.parse.quote(TOKEN_NAME)}",
        password=password,
        method="DELETE",
    )


def ensure_hec(management_url: str, password: str) -> str:
    enable_hec(management_url, password)
    hec_input = get_hec_input(management_url, password)
    if hec_input:
        token = hec_input.get("token")
        if hec_input.get("index") == INDEX and token:
            return str(token)
        delete_hec_token(management_url, password)
    try:
        return create_hec_token(management_url, password)
    except urllib.error.HTTPError as exc:
        if exc.code != 409:
            raise
        delete_hec_token(management_url, password)
        return create_hec_token(management_url, password)


def build_event() -> dict[str, object]:
    return {
        "index": INDEX,
        "source": "http-event-collector-source",
        "sourcetype": SOURCETYPE,
        "event": {
            "ts": timestamp(),
            "source": random.choice(SOURCES),
            "level": random.choice(LEVELS),
            "request_id": f"hec-{random.randint(100000, 999999)}",
            "message": "event sent through Splunk HTTP Event Collector",
        },
    }


def main() -> int:
    password = os.environ.get("SPLUNK_PASSWORD", "")
    if not password:
        print("SPLUNK_PASSWORD must be set", file=sys.stderr)
        return 2

    management_url = os.environ.get("SPLUNK_MANAGEMENT_URL", "https://splunk-indexer:8089").rstrip("/")
    hec_url = os.environ.get(
        "SPLUNK_HEC_URL",
        "https://splunk-indexer:8088/services/collector/event",
    )

    token = ""
    while not token:
        try:
            token = ensure_hec(management_url, password)
        except (OSError, urllib.error.URLError, urllib.error.HTTPError, RuntimeError) as exc:
            print(f"waiting for HEC setup: {exc}", file=sys.stderr)
            time.sleep(5)

    while True:
        try:
            request(hec_url, token=token, data=build_event(), json_body=True)
        except (OSError, urllib.error.URLError, urllib.error.HTTPError) as exc:
            print(f"waiting for HEC endpoint: {exc}", file=sys.stderr)
        time.sleep(3)


if __name__ == "__main__":
    raise SystemExit(main())

