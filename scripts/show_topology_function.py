#!/usr/bin/env python3
"""Show safe, focused lab topology function configuration details."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def docker_btool(service: str, splunk_bin: str, config: str, *args: str) -> list[str]:
    return [
        "docker",
        "compose",
        "exec",
        "-T",
        "-u",
        "splunk",
        service,
        splunk_bin,
        "btool",
        config,
        "list",
        *args,
        "--debug",
    ]


FUNCTIONS = {
    "search-head": {
        "title": "Search Head function on splunk-indexer",
        "purpose": "Search-time knowledge, embedded web access, and role banner configuration.",
        "files": [
            "splunk/indexer/apps/lab_index/default/props.conf",
            "splunk/indexer/apps/lab_web_proxy/default/web.conf",
            "splunk/indexer/apps/lab_web_proxy/default/global-banner.conf",
            "splunk/common/apps/lab_web_embedding/default/web.conf",
        ],
        "commands": [
            ("Search-time props.conf for lab:app", docker_btool("splunk-indexer", "/opt/splunk/bin/splunk", "props", "lab:app")),
            ("Embedded Splunk Web configuration", docker_btool("splunk-indexer", "/opt/splunk/bin/splunk", "web")),
        ],
    },
    "indexer": {
        "title": "Indexer function on splunk-indexer",
        "purpose": "Dedicated indexes, Splunk-to-Splunk receiving, and index-time parsing.",
        "files": [
            "splunk/indexer/apps/lab_index/default/indexes.conf",
            "splunk/indexer/apps/lab_index/default/inputs.conf",
            "splunk/indexer/apps/lab_index/default/props.conf",
            "splunk/indexer/apps/buttercup_app/default/indexes.conf",
            "splunk/indexer/apps/buttercup_app/default/inputs.conf",
            "splunk/indexer/apps/buttercup_app/default/props.conf",
        ],
        "commands": [
            ("Indexes", docker_btool("splunk-indexer", "/opt/splunk/bin/splunk", "indexes")),
            ("Splunk-to-Splunk receiving", docker_btool("splunk-indexer", "/opt/splunk/bin/splunk", "inputs", "splunktcp://9997")),
            ("Index-time props.conf for lab:app", docker_btool("splunk-indexer", "/opt/splunk/bin/splunk", "props", "lab:app")),
        ],
    },
    "splunk-cloud": {
        "title": "Optional Splunk Cloud destination",
        "purpose": "Cloud forwarding is represented by the Heavy Forwarder outputs layer. In production, Splunk Cloud supplies the forwarding app, certificates, and outputs.conf targets.",
        "files": [
            "splunk/deployment-apps/TA_common_outputs/default/outputs.conf",
            "splunk/deployment-apps/TA_heavy_forwarder_parsing/default/props.conf",
        ],
        "commands": [
            ("Heavy Forwarder outputs.conf", docker_btool("heavy-forwarder", "/opt/splunk/bin/splunk", "outputs")),
        ],
    },
    "uf-direct": {
        "title": "Universal Forwarder direct path",
        "purpose": "Collects local file, TCP, UDP, JSON, and OpenTelemetry-style file inputs and forwards directly to the indexer.",
        "files": [
            "splunk/deployment-apps/TA_linux_file_inputs/default/inputs.conf",
            "splunk/deployment-apps/TA_network_inputs/default/inputs.conf",
            "splunk/deployment-apps/TA_common_outputs/default/outputs.conf",
            "splunk/deployment-server/serverclass.conf",
        ],
        "commands": [
            ("Direct UF inputs.conf", docker_btool("universal-forwarder", "/opt/splunkforwarder/bin/splunk", "inputs")),
            ("Direct UF outputs.conf", docker_btool("universal-forwarder", "/opt/splunkforwarder/bin/splunk", "outputs")),
        ],
    },
    "heavy-forwarder": {
        "title": "Heavy Forwarder parsing and routing function",
        "purpose": "Receives forwarded data, applies parsing or masking rules, runs scripted inputs, and forwards to Enterprise or optional Cloud destinations.",
        "files": [
            "splunk/deployment-apps/TA_heavy_forwarder_receiving/default/inputs.conf",
            "splunk/deployment-apps/TA_heavy_forwarder_parsing/default/props.conf",
            "splunk/deployment-apps/TA_heavy_forwarder_parsing/default/transforms.conf",
            "splunk/deployment-apps/TA_common_outputs/default/outputs.conf",
            "splunk/deployment-apps/TA_scripted_inputs/default/inputs.conf",
        ],
        "commands": [
            ("Heavy Forwarder receiving inputs.conf", docker_btool("heavy-forwarder", "/opt/splunk/bin/splunk", "inputs")),
            ("Heavy Forwarder props.conf", docker_btool("heavy-forwarder", "/opt/splunk/bin/splunk", "props", "lab:app")),
            ("Heavy Forwarder transforms.conf", docker_btool("heavy-forwarder", "/opt/splunk/bin/splunk", "transforms")),
            ("Heavy Forwarder outputs.conf", docker_btool("heavy-forwarder", "/opt/splunk/bin/splunk", "outputs")),
        ],
    },
    "uf-via-heavy": {
        "title": "Universal Forwarder via Heavy Forwarder path",
        "purpose": "Collects local inputs and forwards them to the Heavy Forwarder for parsing, masking, and onward routing.",
        "files": [
            "splunk/deployment-apps/TA_linux_file_inputs/default/inputs.conf",
            "splunk/deployment-apps/TA_network_inputs/default/inputs.conf",
            "splunk/deployment-apps/TA_outputs_to_heavy/default/outputs.conf",
            "splunk/deployment-server/serverclass.conf",
        ],
        "commands": [
            ("Via-heavy UF inputs.conf", docker_btool("universal-forwarder-via-heavy", "/opt/splunkforwarder/bin/splunk", "inputs")),
            ("Via-heavy UF outputs.conf", docker_btool("universal-forwarder-via-heavy", "/opt/splunkforwarder/bin/splunk", "outputs")),
        ],
    },
}


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


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: show_topology_function.py <search-head|indexer|splunk-cloud|uf-direct|heavy-forwarder|uf-via-heavy>", file=sys.stderr)
        return 2

    definition = FUNCTIONS.get(sys.argv[1])
    if not definition:
        print(f"unknown topology function: {sys.argv[1]}", file=sys.stderr)
        return 2

    print(definition["title"])
    print(definition["purpose"])
    print()
    print("Relevant lab files")
    for path in definition["files"]:
        print_file(path)

    for label, command in definition["commands"]:
        print()
        print("=" * 80)
        print(f"EFFECTIVE RUNTIME CONFIG: {label}")
        print("=" * 80)
        print(run(command))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
