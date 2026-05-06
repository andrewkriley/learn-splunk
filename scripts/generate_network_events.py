#!/usr/bin/env python3
"""Generate simple TCP and UDP events for the Splunk forwarding lab."""

from __future__ import annotations

import json
import random
import socket
import sys
import time
from datetime import datetime, timezone


LEVELS = ("INFO", "INFO", "WARN", "ERROR")
SOURCES = ("payment-api", "edge-proxy", "inventory-worker", "auth-gateway")


def build_event(protocol: str) -> bytes:
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "+0000"
    payload = {
        "protocol": protocol,
        "source": random.choice(SOURCES),
        "level": random.choice(LEVELS),
        "bytes": random.randint(256, 8192),
        "request_id": f"net-{random.randint(100000, 999999)}",
    }
    line = f"ts={timestamp} app=network_source event={json.dumps(payload, separators=(',', ':'))}\n"
    return line.encode("utf-8")


def send_tcp(host: str, port: int) -> None:
    with socket.create_connection((host, port), timeout=5) as sock:
        sock.sendall(build_event("tcp"))


def send_udp(host: str, port: int) -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.sendto(build_event("udp"), (host, port))


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: generate_network_events.py <host> <tcp_port> <udp_port>", file=sys.stderr)
        return 2

    host = sys.argv[1]
    tcp_port = int(sys.argv[2])
    udp_port = int(sys.argv[3])

    while True:
        try:
            send_tcp(host, tcp_port)
            send_udp(host, udp_port)
        except OSError as exc:
            print(f"waiting for network input on {host}: {exc}", file=sys.stderr)
        time.sleep(3)


if __name__ == "__main__":
    raise SystemExit(main())

