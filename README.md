# Learn Splunk

A local, practical Splunk learning lab for getting data in.

This project walks through a full forwarding topology:

- Splunk Enterprise receiver/indexer
- Splunk Enterprise deployment server, now called agent management in Splunk 10.x docs
- Splunk Enterprise heavy forwarder
- Splunk Universal Forwarders for both `UF -> Indexer` and `UF -> Heavy Forwarder -> Indexer`
- File, TCP, UDP, JSON, XML, OpenTelemetry-style JSON, HEC, scripted, masked PII, and Buttercup Games app data source examples
- Deployment apps, server classes, and the core `inputs.conf`, `outputs.conf`, `props.conf`, and `serverclass.conf` files
- Small file and network event generators so searches return real events
- A local Splunk MCP server for AI-assisted SPL validation, index inspection, and safe search examples

The lab is for learning only. It is not a production Splunk architecture.

## Documentation Reviewed

This scaffold follows the Splunk documentation for:

- Splunk Enterprise and Universal Forwarder documentation from <https://docs.splunk.com/Documentation>
- Forwarding and receiving fundamentals
- Universal forwarder behavior and deployment
- Heavy forwarder setup
- Agent management / deployment server concepts
- Deployment apps and server classes
- `inputs.conf`, `outputs.conf`, `props.conf`, and `serverclass.conf`
- Official Docker-Splunk usage and environment variables

## Prerequisites

- Docker Desktop or Docker Engine with Docker Compose
- Enough local resources for multiple Splunk containers
- A Splunk-compatible admin password
- Acceptance of the Splunk license and Splunk General Terms before running the containers

## Quick Start

1. Create your local environment file:

   ```sh
   cp .env.example .env
   ```

2. Edit `.env` and set `SPLUNK_PASSWORD` to a local lab password that meets Splunk password requirements.
   You can also change `COMPOSE_PROJECT_NAME` and any `*_PORT` values if you want
   to run multiple clones or avoid conflicts with services already using the
   default ports.

3. Start the lab:

   ```sh
   docker compose up -d
   ```

4. Wait for Splunk to finish first-time provisioning. This can take several minutes.

5. Open Splunk Web:

   - Guided lesson cockpit: <http://learn.localtest.me:3000>
   - Indexer/search UI: <http://localhost:8000>
   - Deployment server UI: <http://localhost:18000>
   - Heavy forwarder UI: <http://localhost:28000>

   If you changed `LESSON_WEB_PORT`, use that port instead of `3000`. If you
   changed any Splunk web ports, use the matching values from `.env`.

6. Log in as `admin` with the password from `.env`.

7. Run the validation script:

   ```sh
   python3 scripts/validate_lab.py
   ```

## First Search

After the universal forwarder receives its deployment apps and the sample log generator writes events, search:

```spl
index=lab_file sourcetype=lab:app
```

If you do not see events immediately, wait a minute and run the validation script again.

## Learning Path

The easiest way to use the lab is through the guided lesson cockpit at
<http://learn.localtest.me:3000>. It shows lesson instructions, Splunk Web, and a small
allow-listed lab CLI in one browser window.

The cockpit keeps an `Architecture` pane visible on the left that maps this local
lab into Splunk-style tiers: search, indexing, collection, and management. Lesson
modules appear as a row above the lesson content in the middle pane, while the
right pane hosts Splunk Web and Lab CLI tabs.

The lesson pane borrows selected `splunk-lab` lab-guide patterns: copy buttons on
command and SPL snippets, callout-style notes, compact reference tables, and
step-oriented lesson sections. The top bar also shows lightweight service status
badges so you can quickly see whether Splunk Web and MCP-facing services are
reachable.

The cockpit embeds Splunk through same-origin path proxies so Splunk login cookies
work inside the embedded panes:

- `http://learn.localtest.me:3000/splunk/` for the indexer/search UI
- `http://learn.localtest.me:3000/deployment/` for the deployment server UI
- `http://learn.localtest.me:3000/heavy/` for the heavy forwarder UI

The source lessons are:

- `lessons/00-topology.md`
- `lessons/01-get-data-in.md`
- `lessons/02-deployment-server.md`
- `lessons/03-forwarder-configs.md`

Each lesson points at real files in this repo and asks you to change or inspect the running lab.

## Lab CLI In The Browser

The lesson cockpit includes a `Lab CLI` tab. It does not expose a general shell.
Instead, it runs a small allow-list of local lab commands:

- validate the lab
- show Docker Compose service status
- reload the deployment server
- restart the universal forwarder
- list deployment clients
- inspect selected `btool` outputs, inputs, and `props.conf` stanzas

This keeps command execution scoped to the learning workflow while still letting
you complete CLI-based lesson steps from the browser.

The Lab CLI uses Docker Compose from inside the `lesson-web` container. It needs
access to your host Docker socket through `DOCKER_SOCKET` in `.env`. The default
is `/var/run/docker.sock`, which works for most Docker Desktop and Linux
installations. Override it only if your Docker installation uses a different
socket path.

## MCP Integration

The lab includes a local MCP server named `learn-splunk`.

- Endpoint: `http://localhost:8050/mcp`
- Project config: `.mcp.json`
- Service: `splunk-mcp`
- Health check: `http://localhost:8050/healthz`

Use this endpoint from Cursor or another MCP client to inspect the running lab
with tools such as `validate_spl`, `search_oneshot`, `search_export`,
`get_indexes`, `get_saved_searches`, `run_saved_search`, and `get_config`.

The cockpit includes a curated MCP Tool Explorer in the MCP Integration pane.
It exposes only browser-safe, allow-listed tools through the lesson web service:
`validate_spl`, `get_config`, `get_indexes`, and `search_oneshot`.

Example SPL prompts to try through `search_oneshot`:

```spl
index=lab_otel sourcetype=lab:otel | head 5
index=buttercup sourcetype=buttercup_sales | stats sum(revenue) by vendor
index=lab_hec sourcetype=lab:hec | head 5
```

The MCP endpoint is unauthenticated for local learning and is bound to
`127.0.0.1` on the host. Do not expose port `8050` to a LAN or the internet.

## Testing

See `TEST_PLAN.md` for the full test strategy.

Quick checks:

```sh
cd web && npm test
cd .. && docker compose config --quiet
python3 -m py_compile scripts/generate_logs.py scripts/validate_lab.py
python3 scripts/validate_lab.py
python3 scripts/check_mcp_status.py
```

## Important Notes

- Do not commit `.env`; it contains your local Splunk admin password.
- The compose file uses official Splunk container images and keeps image names configurable in `.env`.
- The compose project defaults to `learn-splunk` and does not set fixed container
  names, so multiple clones can run side-by-side if you also change host ports.
- Splunk 10.x requires `SPLUNK_GENERAL_TERMS=--accept-sgt-current-at-splunk-com`.
- The deployment server distributes apps from `splunk/deployment-apps`.
- The indexer has a local app under `splunk/indexer/apps/lab_index` to create dedicated data-source indexes and enable receiving on port `9997`.
