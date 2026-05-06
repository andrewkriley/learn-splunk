#!/usr/bin/env node
import { randomUUID } from "crypto";
import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SplunkAPIError, SplunkClient } from "./splunkClient";

const config = {
  name: process.env.SERVER_NAME || "Learn Splunk MCP",
  description: process.env.SERVER_DESCRIPTION || "MCP server for the Learn Splunk lab",
  host: process.env.HOST || "0.0.0.0",
  port: parseInt(process.env.PORT || "8050", 10),
  transport: process.env.TRANSPORT || "http",
  splunk_host: process.env.SPLUNK_HOST || "splunk-indexer",
  splunk_port: parseInt(process.env.SPLUNK_PORT || "8089", 10),
  splunk_username: process.env.SPLUNK_USERNAME || "admin",
  splunk_password: process.env.SPLUNK_PASSWORD,
  splunk_token: process.env.SPLUNK_TOKEN,
  verify_ssl: process.env.VERIFY_SSL?.toLowerCase() === "true",
  spl_max_events_count: parseInt(process.env.SPL_MAX_EVENTS_COUNT || "1000", 10),
  spl_risk_tolerance: parseInt(process.env.SPL_RISK_TOLERANCE || "75", 10),
  spl_safe_timerange: process.env.SPL_SAFE_TIMERANGE || "24h",
  spl_sanitize_output: process.env.SPL_SANITIZE_OUTPUT?.toLowerCase() !== "false",
};

let splunkClient: SplunkClient | null = null;

function validateSplQuery(query: string, safeTimerange: string): [number, string] {
  let riskScore = 0;
  const messages: string[] = [];
  const lowered = query.toLowerCase();

  if (!/earliest\s*=/.test(lowered)) {
    riskScore += 30;
    messages.push(`No earliest time bound found. Prefer a safe window such as earliest=-${safeTimerange}.`);
  }
  if (/\|\s*delete\b/.test(lowered)) {
    riskScore += 100;
    messages.push("The delete command is destructive and blocked for this lab.");
  }
  if (/\|\s*(map|script|sendemail)\b/.test(lowered)) {
    riskScore += 40;
    messages.push("The query uses a high-risk command for a local learning lab.");
  }
  if (!/\|\s*(head|stats|table|fields|timechart|top|rare|dedup)\b/.test(lowered)) {
    riskScore += 10;
    messages.push("Consider narrowing output with stats, table, fields, or head.");
  }

  return [Math.min(riskScore, 100), messages.join(" ") || "Query appears acceptable for the lab."];
}

function sanitizeOutput(events: Record<string, unknown>[]): Record<string, unknown>[] {
  const sensitivePattern = /(password|token|secret|authorization|session|cookie)/i;
  return events.map((event) => {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(event)) {
      sanitized[key] = sensitivePattern.test(key) ? "********" : value;
    }
    return sanitized;
  });
}

function formatError(error: unknown, context: string): string {
  if (error instanceof SplunkAPIError) {
    return JSON.stringify({ error: error.message, statusCode: error.statusCode, details: error.details }, null, 2);
  }
  return JSON.stringify({ error: `${context}: ${error}` }, null, 2);
}

function asText(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function normalizeQuery(query: string): string {
  return query.trim().startsWith("|") || query.trim().startsWith("search ") ? query : `search ${query}`;
}

async function initializeSplunkClient() {
  splunkClient = new SplunkClient(config);
  await splunkClient.connect();
  console.log("Splunk client connected");
}

function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: config.name, version: "0.1.0" },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.tool(
    "validate_spl",
    "Validate an SPL query for potential risks and inefficiencies",
    { query: z.string().describe("The SPL query to validate") },
    async ({ query }) => {
      const [riskScore, riskMessage] = validateSplQuery(query, config.spl_safe_timerange);
      return asText({
        risk_score: riskScore,
        risk_message: riskMessage,
        risk_tolerance: config.spl_risk_tolerance,
        would_execute: riskScore <= config.spl_risk_tolerance,
      });
    },
  );

  server.tool(
    "search_oneshot",
    "Run a oneshot search query in Splunk and return results",
    {
      query: z.string().describe("The Splunk search query, for example index=lab_otel | head 10"),
      earliest_time: z.string().default("-24h").describe("Start time for search"),
      latest_time: z.string().default("now").describe("End time for search"),
      max_count: z.number().default(100).describe("Maximum number of results"),
      risk_tolerance: z.number().optional().describe("Override SPL risk tolerance"),
      sanitize_output: z.boolean().optional().describe("Redact sensitive-looking fields"),
    },
    async ({ query, earliest_time, latest_time, max_count, risk_tolerance, sanitize_output }) => {
      if (!splunkClient) {
        return asText({ error: "Splunk client not initialized" });
      }
      try {
        const tolerance = risk_tolerance ?? config.spl_risk_tolerance;
        const [riskScore, riskMessage] = validateSplQuery(query, config.spl_safe_timerange);
        if (riskScore > tolerance) {
          return asText({
            error: `Query exceeds risk tolerance (${riskScore} > ${tolerance}).`,
            risk_score: riskScore,
            risk_tolerance: tolerance,
            risk_message: riskMessage,
            search_executed: false,
          });
        }
        const count = max_count === 100 ? config.spl_max_events_count : max_count;
        let events = await splunkClient.searchOneshot(query, earliest_time, latest_time, count);
        if (sanitize_output ?? config.spl_sanitize_output) {
          events = sanitizeOutput(events);
        }
        return asText({
          query: normalizeQuery(query),
          event_count: events.length,
          events,
          search_params: { earliest_time, latest_time, max_count: count },
        });
      } catch (error) {
        return asText(formatError(error, "Search failed"));
      }
    },
  );

  server.tool(
    "search_export",
    "Run an export search query in Splunk that streams results immediately",
    {
      query: z.string().describe("The Splunk search query"),
      earliest_time: z.string().default("-24h").describe("Start time for search"),
      latest_time: z.string().default("now").describe("End time for search"),
      max_count: z.number().default(100).describe("Maximum number of results"),
      risk_tolerance: z.number().optional().describe("Override SPL risk tolerance"),
      sanitize_output: z.boolean().optional().describe("Redact sensitive-looking fields"),
    },
    async ({ query, earliest_time, latest_time, max_count, risk_tolerance, sanitize_output }) => {
      if (!splunkClient) {
        return asText({ error: "Splunk client not initialized" });
      }
      try {
        const tolerance = risk_tolerance ?? config.spl_risk_tolerance;
        const [riskScore, riskMessage] = validateSplQuery(query, config.spl_safe_timerange);
        if (riskScore > tolerance) {
          return asText({
            error: `Query exceeds risk tolerance (${riskScore} > ${tolerance}).`,
            risk_score: riskScore,
            risk_tolerance: tolerance,
            risk_message: riskMessage,
            search_executed: false,
          });
        }
        const count = max_count === 100 ? config.spl_max_events_count : max_count;
        let events = await splunkClient.searchExport(query, earliest_time, latest_time, count);
        if (sanitize_output ?? config.spl_sanitize_output) {
          events = sanitizeOutput(events);
        }
        return asText({
          query: normalizeQuery(query),
          event_count: events.length,
          events,
          is_preview: false,
        });
      } catch (error) {
        return asText(formatError(error, "Export search failed"));
      }
    },
  );

  server.tool("get_indexes", "Get list of available Splunk indexes with detailed information", {}, async () => {
    if (!splunkClient) {
      return asText({ error: "Splunk client not initialized" });
    }
    try {
      const indexes = await splunkClient.getIndexes();
      return asText({ indexes, count: indexes.length });
    } catch (error) {
      return asText(formatError(error, "Failed to get indexes"));
    }
  });

  server.tool("get_saved_searches", "Get list of saved searches available in Splunk", {}, async () => {
    if (!splunkClient) {
      return asText({ error: "Splunk client not initialized" });
    }
    try {
      const saved_searches = await splunkClient.getSavedSearches();
      return asText({ saved_searches, count: saved_searches.length });
    } catch (error) {
      return asText(formatError(error, "Failed to get saved searches"));
    }
  });

  server.tool(
    "run_saved_search",
    "Run a saved search by name",
    {
      search_name: z.string().describe("Name of the saved search to run"),
      trigger_actions: z.boolean().default(false).describe("Whether to trigger saved search actions"),
    },
    async ({ search_name, trigger_actions }) => {
      if (!splunkClient) {
        return asText({ error: "Splunk client not initialized" });
      }
      try {
        const result = await splunkClient.runSavedSearch(search_name, trigger_actions);
        return asText(result);
      } catch (error) {
        return asText(formatError(error, "Failed to run saved search"));
      }
    },
  );

  server.tool("get_config", "Get current server configuration", {}, async () => {
    const configCopy: Record<string, unknown> = { ...config };
    delete configCopy.splunk_password;
    delete configCopy.splunk_token;
    configCopy.splunk_connected = splunkClient !== null;
    return asText(configCopy);
  });

  server.resource("indexes", "splunk://indexes", async () => {
    if (!splunkClient) {
      return {
        contents: [{ uri: "splunk://indexes", text: "Splunk client not initialized", mimeType: "text/plain" }],
      };
    }
    const indexes = await splunkClient.getIndexes();
    const rows = indexes
      .map((idx) => `| ${idx.name} | ${idx.totalEventCount} | ${idx.currentDBSizeMB} |`)
      .join("\n");
    return {
      contents: [{
        uri: "splunk://indexes",
        text: `# Splunk Indexes\n\n| Index | Events | Size MB |\n|---|---:|---:|\n${rows}\n`,
        mimeType: "text/plain",
      }],
    };
  });

  server.resource("saved-searches", "splunk://saved-searches", async () => {
    if (!splunkClient) {
      return {
        contents: [{ uri: "splunk://saved-searches", text: "Splunk client not initialized", mimeType: "text/plain" }],
      };
    }
    const searches = await splunkClient.getSavedSearches();
    const text = searches
      .map((search) => `## ${search.name}\n\n\`${search.search || ""}\`\n`)
      .join("\n");
    return {
      contents: [{ uri: "splunk://saved-searches", text: `# Splunk Saved Searches\n\n${text}`, mimeType: "text/plain" }],
    };
  });

  return server;
}

async function main() {
  if (config.transport === "stdio") {
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};
    console.error = () => {};
  }

  await initializeSplunkClient();

  if (config.transport === "stdio") {
    const transport = new StdioServerTransport();
    await createMcpServer().connect(transport);
    return;
  }

  if (config.transport !== "http") {
    throw new Error(`Unsupported transport for this lab: ${config.transport}`);
  }

  const app = express();
  app.use(express.json());

  const transports = new Map<string, StreamableHTTPServerTransport>();
  const sessionLastSeen = new Map<string, number>();
  const sessionTtlMs = 10 * 60 * 1000;

  const evictTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, lastSeen] of sessionLastSeen) {
      if (now - lastSeen > sessionTtlMs) {
        transports.delete(id);
        sessionLastSeen.delete(id);
      }
    }
  }, 5 * 60 * 1000);
  evictTimer.unref();

  const httpHandler: express.RequestHandler = async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport | undefined;

    if (sessionId) {
      transport = transports.get(sessionId);
      if (!transport) {
        res.status(404).json({ error: `Session not found: ${sessionId}` });
        return;
      }
      sessionLastSeen.set(sessionId, Date.now());
    } else {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport!);
          sessionLastSeen.set(id, Date.now());
        },
      });
      transport.onclose = () => {
        if (transport!.sessionId) {
          transports.delete(transport!.sessionId);
          sessionLastSeen.delete(transport!.sessionId);
        }
      };
      await createMcpServer().connect(transport);
    }

    await transport.handleRequest(req, res, req.body);
  };

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, splunk_connected: splunkClient !== null, server: config.name });
  });
  app.post("/mcp", httpHandler);
  app.get("/mcp", httpHandler);
  app.delete("/mcp", httpHandler);

  app.listen(config.port, config.host, () => {
    console.log(`HTTP Server running on http://${config.host}:${config.port}/mcp`);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
