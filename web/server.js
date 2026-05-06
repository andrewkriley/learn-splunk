import express from "express";
import MarkdownIt from "markdown-it";
import { createProxyMiddleware } from "http-proxy-middleware";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

export function createApp(options = {}) {
  const app = express();
  const labRoot = options.labRoot || process.env.LAB_ROOT || path.resolve(__dirname, "..");
  const lessonsDir = options.lessonsDir || path.join(labRoot, "lessons");
  const publicDir = options.publicDir || path.join(__dirname, "public");
  const splunkPassword = options.splunkPassword ?? process.env.SPLUNK_PASSWORD ?? "";

  function rewriteCookiePath(cookie, prefix) {
    if (!prefix) {
      return cookie;
    }

    return cookie.replace(/;\s*Path=([^;]*)/i, (_match, cookiePath) => {
      const normalizedPath = cookiePath === "/" ? "/" : cookiePath.replace(/\/$/, "");
      if (normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)) {
        return `; Path=${normalizedPath}`;
      }
      const rewrittenPath = `${prefix}${normalizedPath}`.replace(/\/$/, "") || prefix;
      return `; Path=${rewrittenPath}`;
    });
  }

  function appendExpiredCookie(res, name, cookiePath, domain = "") {
    const domainAttribute = domain ? `; Domain=${domain}` : "";
    res.append(
      "Set-Cookie",
      `${name}=; Path=${cookiePath}${domainAttribute}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0`,
    );
  }

  function expireSplunkCookies(res, paths) {
    const cookieNames = [
      "cval",
      "splunkweb_uid",
      "splunkweb_mfa_return_to_8000",
      "session_id_8000",
      "splunkd_8000",
      "splunkweb_csrf_token_8000",
    ];

    for (const name of cookieNames) {
      for (const cookiePath of paths) {
        appendExpiredCookie(res, name, cookiePath);
        appendExpiredCookie(res, name, cookiePath, ".localtest.me");
      }
    }
  }

  function expireLegacySplunkCookies(res) {
    expireSplunkCookies(res, ["/", "/en-US/account", "/en-US/account/"]);
  }

  function sendSplunkPaneReset(res, prefix) {
    const loginPath = `${prefix}/en-US/account/login`;
    const returnTo = `${prefix}/en-US/app/launcher/home`;
    const prefixedPaths = [
      prefix,
      `${prefix}/en-US/account`,
      `${prefix}/en-US/account/`,
    ];

    res.setHeader("Cache-Control", "no-store");
    expireLegacySplunkCookies(res);
    expireSplunkCookies(res, prefixedPaths);
    res.redirect(303, `${loginPath}?return_to=${encodeURIComponent(returnTo)}`);
  }

  async function sendCockpit(res, next) {
    try {
      const html = await fs.readFile(path.join(publicDir, "index.html"), "utf-8");
      const rendered = renderLesson(html);
      res.setHeader("Cache-Control", "no-store");
      expireLegacySplunkCookies(res);
      res.type("html").send(rendered);
    } catch (error) {
      next(error);
    }
  }

  function buildProxyOptions(prefix = "") {
    return {
    autoRewrite: true,
    changeOrigin: true,
    ws: true,
    secure: false,
    on: {
      proxyRes(proxyRes, req) {
        delete proxyRes.headers["x-frame-options"];
        delete proxyRes.headers["content-security-policy"];
        delete proxyRes.headers["content-security-policy-report-only"];

        if (prefix && proxyRes.headers["set-cookie"]) {
          proxyRes.headers["set-cookie"] = proxyRes.headers["set-cookie"].map((cookie) =>
            rewriteCookiePath(cookie, prefix),
          );
        }

        if (proxyRes.headers.location) {
          const host = req.headers.host;
          const location = new URL(proxyRes.headers.location, `http://${host}`);
          location.protocol = "http:";
          location.host = host;
          if (prefix && !location.pathname.startsWith(prefix)) {
            location.pathname = `${prefix}${location.pathname}`;
          }
          proxyRes.headers.location = location.toString();
        }
      },
    },
  };
  }

  const hostProxyOptions = buildProxyOptions();

  const hostProxies = {};
  for (const hostname of ["splunk.localhost", "splunk.localtest.me"]) {
    hostProxies[hostname] = createProxyMiddleware({
      ...hostProxyOptions,
      target: options.splunkTarget || "http://splunk-indexer:8000",
    });
  }
  for (const hostname of ["deployment.localhost", "deployment.localtest.me"]) {
    hostProxies[hostname] = createProxyMiddleware({
      ...hostProxyOptions,
      target: options.deploymentTarget || "http://deployment-server:8000",
    });
  }
  for (const hostname of ["heavy.localhost", "heavy.localtest.me"]) {
    hostProxies[hostname] = createProxyMiddleware({
      ...hostProxyOptions,
      target: options.heavyTarget || "http://heavy-forwarder:8000",
    });
  }

  // Proxy hostnames first. Otherwise express.static can serve the lesson app for
  // splunk.localhost and create an iframe recursion instead of showing Splunk.
  app.use((req, res, next) => {
    const hostname = (req.headers.host || "").split(":")[0];
    const proxy = hostProxies[hostname];
    if (proxy) {
      proxy(req, res, next);
      return;
    }
    next();
  });

  app.get("/splunk/reset", (_req, res) => {
    sendSplunkPaneReset(res, "/splunk");
  });

  app.get("/deployment/reset", (_req, res) => {
    sendSplunkPaneReset(res, "/deployment");
  });

  app.get("/heavy/reset", (_req, res) => {
    sendSplunkPaneReset(res, "/heavy");
  });

  const pathProxies = {
    "/splunk": createProxyMiddleware({
      ...buildProxyOptions("/splunk"),
      target: options.splunkTarget || "http://splunk-indexer:8000",
    }),
    "/deployment": createProxyMiddleware({
      ...buildProxyOptions("/deployment"),
      target: options.deploymentTarget || "http://deployment-server:8000",
    }),
    "/heavy": createProxyMiddleware({
      ...buildProxyOptions("/heavy"),
      target: options.heavyTarget || "http://heavy-forwarder:8000",
    }),
  };

  app.use((req, res, next) => {
    const prefix = Object.keys(pathProxies).find(
      (candidate) => req.path === candidate || req.path.startsWith(`${candidate}/`),
    );
    if (prefix) {
      pathProxies[prefix](req, res, next);
      return;
    }
    next();
  });

  app.use(express.json());

  app.get(["/", "/index.html"], (_req, res, next) => {
    sendCockpit(res, next);
  });

  app.use(express.static(publicDir));

  const commands = {
    validate: {
      label: "Run full lab validation",
      cmd: "python3",
      args: ["scripts/validate_lab.py"],
    },
    composePs: {
      label: "Show Docker Compose services",
      cmd: "docker",
      args: ["compose", "ps"],
    },
    reloadDeploymentServer: {
      label: "Reload deployment server",
      cmd: "docker",
      args: [
        "compose",
        "exec",
        "-T",
        "-u",
        "splunk",
        "deployment-server",
        "/opt/splunk/bin/splunk",
        "reload",
        "deploy-server",
        "-auth",
        `admin:${splunkPassword}`,
      ],
    },
    restartUniversalForwarder: {
      label: "Restart universal forwarders",
      cmd: "docker",
      args: ["compose", "restart", "universal-forwarder", "universal-forwarder-via-heavy"],
    },
    listDeploymentClients: {
      label: "List deployment clients",
      cmd: "docker",
      args: [
        "compose",
        "exec",
        "-T",
        "-u",
        "splunk",
        "deployment-server",
        "/opt/splunk/bin/splunk",
        "list",
        "deploy-clients",
        "-auth",
        `admin:${splunkPassword}`,
      ],
    },
    showDeployableApps: {
      label: "Show deployment apps and server classes",
      cmd: "python3",
      args: ["scripts/show_deployable_apps.py"],
    },
    checkMcpStatus: {
      label: "Check Learn Splunk MCP status",
      cmd: "python3",
      args: ["scripts/check_mcp_status.py", "http://splunk-mcp:8050/healthz"],
    },
    listForwardServers: {
      label: "List universal forwarder outputs",
      cmd: "docker",
      args: [
        "compose",
        "exec",
        "-T",
        "-u",
        "splunk",
        "universal-forwarder",
        "/opt/splunkforwarder/bin/splunk",
        "list",
        "forward-server",
        "-auth",
        `admin:${splunkPassword}`,
      ],
    },
    btoolInputs: {
      label: "Show active UF inputs.conf",
      cmd: "docker",
      args: [
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
    btoolOutputs: {
      label: "Show active UF outputs.conf",
      cmd: "docker",
      args: [
        "compose",
        "exec",
        "-T",
        "-u",
        "splunk",
        "universal-forwarder",
        "/opt/splunkforwarder/bin/splunk",
        "btool",
        "outputs",
        "list",
        "--debug",
      ],
    },
    btoolIndexerProps: {
      label: "Show indexer/search props.conf for lab:app",
      cmd: "docker",
      args: [
        "compose",
        "exec",
        "-T",
        "-u",
        "splunk",
        "splunk-indexer",
        "/opt/splunk/bin/splunk",
        "btool",
        "props",
        "list",
        "lab:app",
        "--debug",
      ],
    },
    btoolHeavyProps: {
      label: "Show heavy forwarder props.conf for lab:app",
      cmd: "docker",
      args: [
        "compose",
        "exec",
        "-T",
        "-u",
        "splunk",
        "heavy-forwarder",
        "/opt/splunk/bin/splunk",
        "btool",
        "props",
        "list",
        "lab:app",
        "--debug",
      ],
    },
    dataSourceFile: {
      label: "Data source: file monitor config",
      cmd: "python3",
      args: ["scripts/show_data_source.py", "file"],
    },
    dataSourceTcp: {
      label: "Data source: TCP input config",
      cmd: "python3",
      args: ["scripts/show_data_source.py", "tcp"],
    },
    dataSourceUdp: {
      label: "Data source: UDP input config",
      cmd: "python3",
      args: ["scripts/show_data_source.py", "udp"],
    },
    dataSourceJson: {
      label: "Data source: JSON file input config",
      cmd: "python3",
      args: ["scripts/show_data_source.py", "json"],
    },
    dataSourceOtel: {
      label: "Data source: OpenTelemetry JSON config",
      cmd: "python3",
      args: ["scripts/show_data_source.py", "otel"],
    },
    dataSourceXml: {
      label: "Data source: XML file input config",
      cmd: "python3",
      args: ["scripts/show_data_source.py", "xml"],
    },
    dataSourceHec: {
      label: "Data source: HEC status",
      cmd: "python3",
      args: ["scripts/show_data_source.py", "hec"],
    },
    dataSourceScripted: {
      label: "Data source: scripted input config",
      cmd: "python3",
      args: ["scripts/show_data_source.py", "scripted"],
    },
    dataSourceMasked: {
      label: "Data source: HF regex masking config",
      cmd: "python3",
      args: ["scripts/show_data_source.py", "masked"],
    },
    dataSourceButtercup: {
      label: "Data source: Buttercup Games app config",
      cmd: "python3",
      args: ["scripts/show_data_source.py", "buttercup"],
    },
  };

  function redact(value) {
    if (!splunkPassword) {
      return value;
    }
    return value.split(splunkPassword).join("********");
  }

  function runLabCommand(definition) {
    return new Promise((resolve) => {
      execFile(
        definition.cmd,
        definition.args,
        {
          cwd: labRoot,
          timeout: 60_000,
          maxBuffer: 1024 * 1024,
          env: { ...process.env, COMPOSE_PROJECT_NAME: "splunk-learn-forwarding" },
        },
        (error, stdout, stderr) => {
          resolve({
            ok: !error,
            exitCode: error?.code ?? 0,
            stdout: redact(stdout || ""),
            stderr: redact(stderr || ""),
          });
        },
      );
    });
  }

  function renderLesson(raw) {
    return raw.replaceAll("{{SPLUNK_PASSWORD}}", splunkPassword || "<set SPLUNK_PASSWORD in .env>");
  }

  app.get("/api/lessons", async (_req, res, next) => {
    try {
      const entries = await fs.readdir(lessonsDir);
      const lessons = entries
        .filter((entry) => entry.endsWith(".md"))
        .sort()
        .map((file) => ({
          id: file.replace(/\.md$/, ""),
          title: file.replace(/\.md$/, "").replace(/^\d+-/, "").replaceAll("-", " "),
          file,
        }));
      res.json({ lessons });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/lessons/:id", async (req, res, next) => {
    try {
      const lessonFile = `${req.params.id}.md`;
      if (!/^[a-zA-Z0-9._-]+\.md$/.test(lessonFile)) {
        res.status(400).json({ error: "Invalid lesson id" });
        return;
      }

      const raw = await fs.readFile(path.join(lessonsDir, lessonFile), "utf-8");
      const rendered = renderLesson(raw);
      res.json({ id: req.params.id, markdown: rendered, html: md.render(rendered) });
    } catch (error) {
      if (error.code === "ENOENT") {
        res.status(404).json({ error: "Lesson not found" });
        return;
      }
      next(error);
    }
  });

  app.get("/api/commands", (_req, res) => {
    res.json({
      commands: Object.entries(commands).map(([id, command]) => ({
        id,
        label: command.label,
      })),
    });
  });

  app.post("/api/commands/:id", async (req, res) => {
    const command = commands[req.params.id];
    if (!command) {
      res.status(404).json({ error: "Unknown command" });
      return;
    }

    const result = await runLabCommand(command);
    res.status(result.ok ? 200 : 500).json(result);
  });

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.use((_req, res, next) => {
    sendCockpit(res, next);
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT || 3000);
  const app = createApp();
  app.listen(port, "0.0.0.0", () => {
    console.log(`Lesson web service listening on ${port}`);
  });
}
