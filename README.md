# Learn Splunk

A local, practical Splunk learning lab for Splunk fundamentals: logging in, exploring a forwarding topology, searching sample data, building dashboards, and using MCP-backed tools.

This project stands up a full local lab topology:

- Splunk Enterprise indexer/search head
- Splunk Enterprise deployment server, now called agent management in Splunk 10.x docs
- Splunk Enterprise heavy forwarder
- Splunk Universal Forwarders for both `UF -> Indexer` and `UF -> Heavy Forwarder -> Indexer`
- File, TCP, UDP, JSON, XML, OpenTelemetry-style JSON, HEC, scripted, masked PII, and Buttercup Games app data source examples
- Deployment apps, server classes, and the core `inputs.conf`, `outputs.conf`, `props.conf`, and `serverclass.conf` files
- Small file and network event generators so searches return real events
- A local Learn Splunk MCP server for AI-assisted SPL validation, index inspection, config lookup, and safe search examples

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

## Stand Up The Environment

From a fresh clone:

```sh
git clone git@github.com:andrewkriley/learn-splunk.git
cd learn-splunk
```

If you prefer HTTPS:

```sh
git clone https://github.com/andrewkriley/learn-splunk.git
cd learn-splunk
```

Then configure and start the lab:

1. Create your local environment file:

   ```sh
   cp .env.example .env
   ```

2. Edit `.env`:

   - Set `SPLUNK_PASSWORD` to a local lab password that meets Splunk password requirements.
   - Review `SPLUNK_GENERAL_TERMS=--accept-sgt-current-at-splunk-com` after reading the Splunk General Terms.
   - Keep `COMPOSE_PROJECT_NAME=learn-splunk` unless you want to run multiple clones.
   - Change any `*_PORT` values if the defaults are already in use.
   - Keep `MCP_BIND_HOST=127.0.0.1` so the local MCP endpoint is not exposed beyond your machine.
   - Keep `DOCKER_SOCKET=/var/run/docker.sock` unless your Docker installation uses a different socket path.

3. Start the lab:

   ```sh
   docker compose up -d
   ```

4. Wait for Splunk to finish first-time provisioning. This can take several minutes.
   You can watch container state with:

   ```sh
   docker compose ps
   ```

5. Open the Learn Splunk cockpit:

   - Learn Splunk cockpit: <http://learn.localtest.me:3000>
   - Indexer/search UI: <http://localhost:8000>
   - Deployment server UI: <http://localhost:18000>
   - Heavy forwarder UI: <http://localhost:28000>

   If you changed `LESSON_WEB_PORT`, use that port instead of `3000`. If you
   changed any Splunk web ports, use the matching values from `.env`.

   `learn.localtest.me` resolves to your local machine and is used so the cockpit can embed Splunk panes through same-origin paths.

6. Log in as `admin` with the password from `.env`. The cockpit header also shows the login details for quick reference.

7. Run validation after the containers are up:

   ```sh
   python3 scripts/validate_lab.py
   ```

8. Stop the lab when finished:

   ```sh
   docker compose down
   ```

   To remove lab volumes and start from a clean Splunk provisioning state, run:

   ```sh
   docker compose down -v
   ```

## First Search

After the universal forwarder receives its deployment apps and the sample log generator writes events, search:

```spl
index=lab_file sourcetype=lab:app
```

If you do not see events immediately, wait a minute and run the validation script again.

## Learning Journey

The easiest way to use the lab is through the Learn Splunk cockpit at
<http://learn.localtest.me:3000>. It shows lesson instructions, Splunk Web, and a small
allow-listed lab CLI in one browser window.

The current cockpit journey is:

1. **Start Here**: log in to the Indexer/Search Head pane as `admin`.
2. **Lab Topology**: inspect the Splunk roles, forwarding paths, and data sources. Clicking topology cards opens the matching config in Lab CLI.
3. **Explore Data**: search dedicated indexes, sources, and sourcetypes for the file, network, HEC, OpenTelemetry, scripted, masked, and Buttercup examples.
4. **Create Dashboards**: turn searches into tables, charts, and dashboard panels.
5. **Use Tools (MCP)**: use browser-safe MCP tools for SPL validation, index inspection, config lookup, and safe searches.

The left rail contains the learning journey and lab tools. The middle pane shows
the selected learning section. The persistent right pane hosts the Indexer/Search
Head, Deployment Server, Heavy Forwarder, and Lab CLI tabs. On first load, Start
Here opens the Indexer/Search Head pane; selecting Lab Topology switches the
right pane to Lab CLI.

The top header stays quiet when all containers are healthy and shows a single
generic warning if any container needs attention. The full Status page lists all
Docker Compose containers, including forwarders and sample data generators.

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
- inspect clicked topology functions and data source configuration files

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

The cockpit includes a curated MCP Tool Explorer in the `Use Tools (MCP)` pane.
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
npm --prefix web test
docker compose config --quiet
python3 -m py_compile scripts/*.py
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
