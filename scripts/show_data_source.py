#!/usr/bin/env python3
"""Show safe, focused lab data source configuration details."""

from __future__ import annotations

import base64
import json
import os
import ssl
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEXES_CONF = "splunk/indexer/apps/lab_index/default/indexes.conf"
INDEXER_PROPS = "splunk/indexer/apps/lab_index/default/props.conf"
FILE_INPUTS = "splunk/deployment-apps/TA_linux_file_inputs/default/inputs.conf"
NETWORK_INPUTS = "splunk/deployment-apps/TA_network_inputs/default/inputs.conf"
DIRECT_OUTPUTS = "splunk/deployment-apps/TA_common_outputs/default/outputs.conf"
VIA_HEAVY_OUTPUTS = "splunk/deployment-apps/TA_outputs_to_heavy/default/outputs.conf"
HF_RECEIVING_INPUTS = "splunk/deployment-apps/TA_heavy_forwarder_receiving/default/inputs.conf"
HF_PROPS = "splunk/deployment-apps/TA_heavy_forwarder_parsing/default/props.conf"
HF_TRANSFORMS = "splunk/deployment-apps/TA_heavy_forwarder_parsing/default/transforms.conf"


DATA_SOURCES = {
    "file": {
        "title": "File source -> universal-forwarder -> splunk-indexer",
        "index": "lab_file",
        "source": "/var/log/lab/app.log",
        "sourcetype": "lab:app",
        "files": [
            "scripts/generate_logs.py",
            FILE_INPUTS,
            DIRECT_OUTPUTS,
            INDEXES_CONF,
            INDEXER_PROPS,
        ],
        "command": [
            "docker",
            "compose",
            "exec",
            "-T",
            "-u",
            "splunk",
            "universal-forwarder",
            "/opt/splunkforwarder/bin/splunk",
            "btool",
            "inputs",
            "list",
            "monitor:///var/log/lab/app.log",
            "--debug",
        ],
    },
    "json": {
        "title": "JSON file source -> universal-forwarder -> splunk-indexer",
        "index": "lab_json",
        "source": "/var/log/lab/events.json",
        "sourcetype": "lab:json",
        "files": [
            "scripts/generate_structured_file_events.py",
            FILE_INPUTS,
            DIRECT_OUTPUTS,
            INDEXES_CONF,
            INDEXER_PROPS,
        ],
        "command": [
            "docker",
            "compose",
            "exec",
            "-T",
            "-u",
            "splunk",
            "universal-forwarder",
            "/opt/splunkforwarder/bin/splunk",
            "btool",
            "inputs",
            "list",
            "monitor:///var/log/lab/events.json",
            "--debug",
        ],
    },
    "xml": {
        "title": "XML file source -> universal-forwarder-via-heavy -> heavy-forwarder -> splunk-indexer",
        "index": "lab_xml",
        "source": "/var/log/lab/events.xml",
        "sourcetype": "lab:xml",
        "files": [
            "scripts/generate_structured_file_events.py",
            FILE_INPUTS,
            VIA_HEAVY_OUTPUTS,
            HF_RECEIVING_INPUTS,
            HF_PROPS,
            DIRECT_OUTPUTS,
            INDEXES_CONF,
        ],
        "command": [
            "docker",
            "compose",
            "exec",
            "-T",
            "-u",
            "splunk",
            "universal-forwarder-via-heavy",
            "/opt/splunkforwarder/bin/splunk",
            "btool",
            "inputs",
            "list",
            "monitor:///var/log/lab/events.xml",
            "--debug",
        ],
    },
    "tcp": {
        "title": "TCP source -> universal-forwarder -> splunk-indexer",
        "index": "lab_tcp",
        "source": "tcp:1514",
        "sourcetype": "lab:tcp",
        "files": [
            "scripts/generate_network_events.py",
            NETWORK_INPUTS,
            DIRECT_OUTPUTS,
            INDEXES_CONF,
            INDEXER_PROPS,
        ],
        "command": [
            "docker",
            "compose",
            "exec",
            "-T",
            "-u",
            "splunk",
            "universal-forwarder",
            "/opt/splunkforwarder/bin/splunk",
            "btool",
            "inputs",
            "list",
            "tcp://1514",
            "--debug",
        ],
    },
    "udp": {
        "title": "UDP source -> universal-forwarder-via-heavy -> heavy-forwarder -> splunk-indexer",
        "index": "lab_udp",
        "source": "udp:1515",
        "sourcetype": "lab:udp",
        "files": [
            "scripts/generate_network_events.py",
            NETWORK_INPUTS,
            VIA_HEAVY_OUTPUTS,
            HF_RECEIVING_INPUTS,
            HF_PROPS,
            DIRECT_OUTPUTS,
            INDEXES_CONF,
        ],
        "command": [
            "docker",
            "compose",
            "exec",
            "-T",
            "-u",
            "splunk",
            "universal-forwarder-via-heavy",
            "/opt/splunkforwarder/bin/splunk",
            "btool",
            "inputs",
            "list",
            "udp://1515",
            "--debug",
        ],
    },
    "masked": {
        "title": "Masked PII source -> universal-forwarder-via-heavy -> heavy-forwarder masking -> splunk-indexer",
        "index": "lab_masked",
        "source": "/var/log/lab/pii.log",
        "sourcetype": "lab:masked",
        "files": [
            "scripts/generate_pii_events.py",
            FILE_INPUTS,
            VIA_HEAVY_OUTPUTS,
            HF_RECEIVING_INPUTS,
            HF_PROPS,
            HF_TRANSFORMS,
            DIRECT_OUTPUTS,
            INDEXES_CONF,
        ],
        "command": [
            "docker",
            "compose",
            "exec",
            "-T",
            "-u",
            "splunk",
            "universal-forwarder-via-heavy",
            "/opt/splunkforwarder/bin/splunk",
            "btool",
            "inputs",
            "list",
            "monitor:///var/log/lab/pii.log",
            "--debug",
        ],
    },
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


def run(command: list[str]) -> str:
    result = subprocess.run(
        command,
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return "\n".join(part for part in [result.stdout.strip(), result.stderr.strip()] if part)


def print_metadata(index: str, source: str, sourcetype: str) -> None:
    print(f"index = {index}")
    print(f"source = {source}")
    print(f"sourcetype = {sourcetype}")


def print_file(path: str) -> None:
    file_path = ROOT / path
    print()
    print("=" * 80)
    print(f"FILE: {path}")
    print("=" * 80)
    if not file_path.exists():
        print(f"missing file: {path}")
        return
    print(file_path.read_text(encoding="utf-8").rstrip())


def print_relevant_files(paths: list[str]) -> None:
    print()
    print("Relevant lab files")
    for path in paths:
        print_file(path)


def print_effective_runtime_config(command: list[str]) -> None:
    print()
    print("=" * 80)
    print("EFFECTIVE RUNTIME CONFIG")
    print("=" * 80)
    print(run(command))


def splunk_request(path: str, password: str, data: dict[str, str] | None = None) -> str:
    management_url = os.environ.get("SPLUNK_MANAGEMENT_URL", "https://localhost:8089").rstrip("/")
    url = f"{management_url}{path}"
    encoded_data = urllib.parse.urlencode(data).encode("utf-8") if data else None
    request = urllib.request.Request(url, data=encoded_data)
    token = base64.b64encode(f"admin:{password}".encode("utf-8")).decode("ascii")
    request.add_header("Authorization", f"Basic {token}")
    with urllib.request.urlopen(request, context=ssl._create_unverified_context(), timeout=20) as response:
        return response.read().decode("utf-8", errors="replace")


def get_search_count(password: str, index: str, sourcetype: str) -> str:
    body = splunk_request(
        "/services/search/jobs/export",
        password,
        {
            "search": f"search index={index} earliest=-10m sourcetype={sourcetype} | stats count",
            "output_mode": "json",
        },
    )
    for raw_line in body.splitlines():
        if not raw_line.strip():
            continue
        event = json.loads(raw_line)
        result = event.get("result")
        if result:
            return str(result.get("count", "0"))
    return "0"


def show_hec() -> int:
    env = load_env()
    password = env.get("SPLUNK_PASSWORD", "")
    if not password:
        print("SPLUNK_PASSWORD is not set; cannot inspect HEC.")
        return 1

    print("HEC source -> splunk-indexer HTTP Event Collector")
    print_metadata("lab_hec", "http-event-collector-source", "lab:hec")
    print_relevant_files([
        "scripts/generate_hec_events.py",
        INDEXES_CONF,
        INDEXER_PROPS,
    ])
    print()
    print("=" * 80)
    print("RUNTIME HEC INPUT")
    print("=" * 80)
    body = splunk_request("/services/data/inputs/http?output_mode=json", password)
    payload = json.loads(body)
    for entry in payload.get("entry", []):
        if str(entry.get("name", "")).endswith("lab_hec_source"):
            content = dict(entry.get("content", {}))
            content["token"] = "********"
            for field in ["disabled", "index", "sourcetype", "token"]:
                print(f"{field} = {content.get(field)}")
            break
    else:
        print("lab_hec_source token has not been created yet.")

    print()
    print(f"events_last_10m = {get_search_count(password, 'lab_hec', 'lab:hec')}")
    print("service = http-event-collector-source")
    print("status = sending events when events_last_10m is greater than 0")
    return 0


def show_scripted() -> int:
    stanzas = [
        "script://$SPLUNK_HOME/etc/apps/TA_scripted_inputs/bin/python_scripted_input.py",
        "script://$SPLUNK_HOME/etc/apps/TA_scripted_inputs/bin/bash_scripted_input.sh",
    ]
    print("Scripted source -> heavy-forwarder -> splunk-indexer")
    print_metadata("lab_scripted", "TA_scripted_inputs/bin/*", "lab:scripted:python, lab:scripted:bash")
    print_relevant_files([
        "splunk/deployment-apps/TA_scripted_inputs/default/inputs.conf",
        "splunk/deployment-apps/TA_scripted_inputs/bin/python_scripted_input.py",
        "splunk/deployment-apps/TA_scripted_inputs/bin/bash_scripted_input.sh",
        HF_PROPS,
        DIRECT_OUTPUTS,
        INDEXES_CONF,
    ])
    for stanza in stanzas:
        print()
        print("=" * 80)
        print(f"EFFECTIVE RUNTIME CONFIG: {stanza}")
        print("=" * 80)
        print(run([
            "docker",
            "compose",
            "exec",
            "-T",
            "-u",
            "splunk",
            "heavy-forwarder",
            "/opt/splunk/bin/splunk",
            "btool",
            "inputs",
            "list",
            stanza,
            "--debug",
        ]))
    return 0


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: show_data_source.py <file|json|xml|tcp|udp|hec|scripted|masked>", file=sys.stderr)
        return 2

    source = sys.argv[1]
    if source == "hec":
        return show_hec()
    if source == "scripted":
        return show_scripted()

    definition = DATA_SOURCES.get(source)
    if not definition:
        print(f"unknown data source: {source}", file=sys.stderr)
        return 2

    print(definition["title"])
    print_metadata(definition["index"], definition["source"], definition["sourcetype"])
    print_relevant_files(definition["files"])
    print_effective_runtime_config(definition["command"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

