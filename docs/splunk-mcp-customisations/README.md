# Splunk MCP Server Customisations

This lab builds a local `splunk-mcp` image from Splunk's upstream
`splunk-mcp-server2` repository and overlays the small set of files that Learn
Splunk owns.

## Upstream Source

| Item | Detail |
|---|---|
| Repository | `https://github.com/splunk/splunk-mcp-server2` |
| Pinned ref | `fac6cbb37be057a68607642d8d60d9c19ba5a060` |
| Build path | `mcp/Dockerfile` clones the repo, checks out the pinned ref, installs npm dependencies, then overlays local files. |

Pinning the upstream ref avoids silently changing the MCP runtime when the image
is rebuilt.

## Local Overlay Files

| Local file | Upstream path | Purpose |
|---|---|---|
| `mcp/server.ts` | `/app/typescript/server.ts` | Streamable HTTP transport, tool registration, SPL risk guardrails, and Learn Splunk branding. |
| `mcp/splunkClient.ts` | `/app/typescript/splunkClient.ts` | HTTPS client for Splunk management API with local TLS and timeout settings. |

## Runtime Contract

The Compose service passes:

- `TRANSPORT=http`
- `HOST=0.0.0.0`
- `PORT=8050`
- `SPLUNK_HOST=splunk-indexer`
- `SPLUNK_PORT=8089`
- `SPLUNK_USERNAME=admin`
- `SPLUNK_PASSWORD` from `.env`
- `VERIFY_SSL=false` for the local self-signed Splunk certificate

The host port is bound to `127.0.0.1:8050:8050`. The MCP endpoint is
unauthenticated by design for this local lab and must not be exposed externally.

## Exposed MCP Tools

- `validate_spl`
- `search_oneshot`
- `search_export`
- `get_indexes`
- `get_saved_searches`
- `run_saved_search`
- `get_config`

## Updating Upstream

1. Review upstream changes in `splunk-mcp-server2`.
2. Update the pinned ref in `mcp/Dockerfile`.
3. Rebuild with `docker compose build splunk-mcp`.
4. Run the web tests and MCP smoke checks.
