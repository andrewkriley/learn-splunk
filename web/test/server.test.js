import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createApp } from "../server.js";

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server.address().port;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  return { response, body: await response.json() };
}

function requestWithHost(port, host) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/",
        headers: { host },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf-8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolve({ statusCode: res.statusCode, body }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function mcpResponse(payload, sessionId = "test-session") {
  return new Response(`event: message\ndata: ${JSON.stringify(payload)}\n\n`, {
    status: 200,
    headers: { "mcp-session-id": sessionId },
  });
}

test("lesson API lists markdown lessons and renders lesson HTML", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "splunk-lessons-"));
  const lessonsDir = path.join(root, "lessons");
  const publicDir = path.join(root, "public");
  await mkdir(lessonsDir);
  await mkdir(publicDir);
  await writeFile(path.join(publicDir, "index.html"), "<p>lesson app</p>");
  await writeFile(path.join(lessonsDir, "00-intro.md"), "# Intro\n\nRead me.");
  await writeFile(path.join(lessonsDir, "notes.txt"), "ignore me");

  const server = http.createServer(
    createApp({ labRoot: root, lessonsDir, publicDir, splunkPassword: "secret" }),
  );
  t.after(() => server.close());
  const port = await listen(server);

  const lessons = await fetchJson(`http://127.0.0.1:${port}/api/lessons`);
  assert.equal(lessons.response.status, 200);
  assert.deepEqual(lessons.body.lessons, [
    { id: "00-intro", title: "intro", file: "00-intro.md" },
  ]);

  const lesson = await fetchJson(`http://127.0.0.1:${port}/api/lessons/00-intro`);
  assert.equal(lesson.response.status, 200);
  assert.match(lesson.body.html, /<h1>Intro<\/h1>/);
});

test("lesson API renders the local dev Splunk password at runtime", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "splunk-password-"));
  const lessonsDir = path.join(root, "lessons");
  const publicDir = path.join(root, "public");
  await mkdir(lessonsDir);
  await mkdir(publicDir);
  await writeFile(path.join(publicDir, "index.html"), "<p>lesson app</p>");
  await writeFile(
    path.join(lessonsDir, "00-login.md"),
    "# Login\n\n## Login Details\n\n- username: `admin`\n- password: `{{SPLUNK_PASSWORD}}`\n",
  );

  const server = http.createServer(
    createApp({
      labRoot: root,
      lessonsDir,
      publicDir,
      splunkPassword: "LocalOnlyPassword123!",
    }),
  );
  t.after(() => server.close());
  const port = await listen(server);

  const lesson = await fetchJson(`http://127.0.0.1:${port}/api/lessons/00-login`);
  assert.equal(lesson.response.status, 200);
  assert.match(lesson.body.markdown, /password: `LocalOnlyPassword123!`/);
  assert.match(lesson.body.html, /LocalOnlyPassword123!/);
  assert.doesNotMatch(lesson.body.markdown, /{{SPLUNK_PASSWORD}}/);
});

test("cockpit page renders the local dev Splunk password at runtime", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "splunk-cockpit-password-"));
  const lessonsDir = path.join(root, "lessons");
  const publicDir = path.join(root, "public");
  await mkdir(lessonsDir);
  await mkdir(publicDir);
  await writeFile(
    path.join(publicDir, "index.html"),
    '<span class="credential-pill">Login: <strong>admin</strong> / <strong>{{SPLUNK_PASSWORD}}</strong></span>',
  );

  const server = http.createServer(
    createApp({
      labRoot: root,
      lessonsDir,
      publicDir,
      splunkPassword: "LocalOnlyPassword123!",
    }),
  );
  t.after(() => server.close());
  const port = await listen(server);

  const response = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/",
        headers: { host: "learn.localtest.me:3000" },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf-8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolve({ statusCode: res.statusCode, body }));
      },
    );
    req.on("error", reject);
    req.end();
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /admin<\/strong> \/ <strong>LocalOnlyPassword123!/);
  assert.doesNotMatch(response.body, /{{SPLUNK_PASSWORD}}/);
});

test("command API exposes props.conf inspection commands", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "splunk-props-commands-"));
  const lessonsDir = path.join(root, "lessons");
  const publicDir = path.join(root, "public");
  await mkdir(lessonsDir);
  await mkdir(publicDir);
  await writeFile(path.join(publicDir, "index.html"), "<p>lesson app</p>");

  const server = http.createServer(createApp({ labRoot: root, lessonsDir, publicDir }));
  t.after(() => server.close());
  const port = await listen(server);

  const { response, body } = await fetchJson(`http://127.0.0.1:${port}/api/commands`);
  assert.equal(response.status, 200);
  assert.ok(
    body.commands.some(
      (command) =>
        command.id === "btoolIndexerProps" &&
        command.label === "Show indexer/search props.conf for lab:app",
    ),
  );
  assert.ok(
    body.commands.some(
      (command) =>
        command.id === "btoolHeavyProps" &&
        command.label === "Show heavy forwarder props.conf for lab:app",
    ),
  );
  assert.ok(
    body.commands.some(
      (command) =>
        command.id === "showDeployableApps" &&
        command.label === "Show deployment apps and server classes",
    ),
  );
  assert.ok(
    body.commands.some(
      (command) =>
        command.id === "checkMcpStatus" &&
        command.label === "Check Learn Splunk MCP status",
    ),
  );
  assert.ok(
    body.commands.some(
      (command) =>
        command.id === "restartUniversalForwarder" &&
        command.label === "Restart universal forwarders",
    ),
  );
  for (const id of [
    "dataSourceFile",
    "dataSourceTcp",
    "dataSourceUdp",
    "dataSourceJson",
    "dataSourceOtel",
    "dataSourceXml",
    "dataSourceHec",
    "dataSourceScripted",
    "dataSourceMasked",
    "dataSourceButtercup",
  ]) {
    assert.ok(body.commands.some((command) => command.id === id));
  }
});

test("restart universal forwarder command restarts both UF paths", async () => {
  const serverSource = await readFile(new URL("../server.js", import.meta.url), "utf-8");

  assert.match(
    serverSource,
    /args:\s*\["compose",\s*"restart",\s*"universal-forwarder",\s*"universal-forwarder-via-heavy"\]/,
  );
});

test("MCP explorer API exposes only curated tools and calls allow-listed tools", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "splunk-mcp-api-"));
  const lessonsDir = path.join(root, "lessons");
  const publicDir = path.join(root, "public");
  await mkdir(lessonsDir);
  await mkdir(publicDir);
  await writeFile(path.join(publicDir, "index.html"), "<p>lesson app</p>");
  const calls = [];
  const fakeFetch = async (_url, options = {}) => {
    const payload = JSON.parse(options.body || "{}");
    calls.push(payload.method);
    if (payload.method === "initialize") {
      return mcpResponse({ jsonrpc: "2.0", id: payload.id, result: { serverInfo: { name: "Learn Splunk MCP" } } });
    }
    if (payload.method === "tools/list") {
      return mcpResponse({
        jsonrpc: "2.0",
        id: payload.id,
        result: {
          tools: [
            { name: "validate_spl", description: "Validate SPL", inputSchema: { properties: {} } },
            { name: "search_oneshot", description: "Search", inputSchema: { properties: {} } },
            { name: "delete_everything", description: "Unsafe", inputSchema: { properties: {} } },
          ],
        },
      });
    }
    if (payload.method === "tools/call") {
      return mcpResponse({
        jsonrpc: "2.0",
        id: payload.id,
        result: { content: [{ type: "text", text: '{"risk_score":0}' }] },
      });
    }
    throw new Error(`Unexpected MCP method ${payload.method}`);
  };

  const server = http.createServer(createApp({ labRoot: root, lessonsDir, publicDir, fetch: fakeFetch }));
  t.after(() => server.close());
  const port = await listen(server);

  const tools = await fetchJson(`http://127.0.0.1:${port}/api/mcp/tools`);
  assert.equal(tools.response.status, 200);
  assert.deepEqual(
    tools.body.tools.map((tool) => tool.name),
    ["validate_spl", "search_oneshot"],
  );

  const call = await fetchJson(`http://127.0.0.1:${port}/api/mcp/tools/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "validate_spl", arguments: { query: "index=lab_file | head 1" } }),
  });
  assert.equal(call.response.status, 200);
  assert.equal(call.body.tool, "validate_spl");
  assert.ok(calls.includes("tools/call"));

  const blocked = await fetchJson(`http://127.0.0.1:${port}/api/mcp/tools/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "delete_everything", arguments: {} }),
  });
  assert.equal(blocked.response.status, 404);
});

test("lab status API reports service reachability without Docker socket access", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "splunk-status-api-"));
  const lessonsDir = path.join(root, "lessons");
  const publicDir = path.join(root, "public");
  await mkdir(lessonsDir);
  await mkdir(publicDir);
  await writeFile(path.join(publicDir, "index.html"), "<p>lesson app</p>");
  const fakeFetch = async (url) => {
    if (String(url).includes("down-service")) {
      throw new Error("unreachable");
    }
    return new Response("ok", { status: 200 });
  };

  const server = http.createServer(
    createApp({
      labRoot: root,
      lessonsDir,
      publicDir,
      fetch: fakeFetch,
      mcpHealthUrl: "http://splunk-mcp:8050/healthz",
      splunkTarget: "http://splunk-indexer:8000/en-US/account/login",
      deploymentTarget: "http://down-service:8000/en-US/account/login",
      heavyTarget: "http://heavy-forwarder:8000/en-US/account/login",
    }),
  );
  t.after(() => server.close());
  const port = await listen(server);

  const { response, body } = await fetchJson(`http://127.0.0.1:${port}/api/lab/status`);
  assert.equal(response.status, 200);
  assert.ok(body.services.some((service) => service.name === "lesson-web" && service.status === "ok"));
  assert.ok(body.services.some((service) => service.name === "splunk-mcp" && service.status === "ok"));
  assert.ok(body.services.some((service) => service.name === "deployment" && service.status === "down"));
});

test("host-based Splunk proxy runs before lesson static assets", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "splunk-proxy-"));
  const lessonsDir = path.join(root, "lessons");
  const publicDir = path.join(root, "public");
  await mkdir(lessonsDir);
  await mkdir(publicDir);
  await writeFile(path.join(publicDir, "index.html"), "LESSON_APP");

  const splunkBackend = http.createServer((_req, res) => {
    res.end("SPLUNK_BACKEND");
  });
  t.after(() => splunkBackend.close());
  const splunkPort = await listen(splunkBackend);

  const server = http.createServer(
    createApp({
      labRoot: root,
      lessonsDir,
      publicDir,
      splunkTarget: `http://127.0.0.1:${splunkPort}`,
    }),
  );
  t.after(() => server.close());
  const port = await listen(server);

  const response = await requestWithHost(port, "splunk.localhost:3000");

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, "SPLUNK_BACKEND");
});

test("host-based Splunk proxy supports same-site localtest.me hosts", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "splunk-localtest-"));
  const lessonsDir = path.join(root, "lessons");
  const publicDir = path.join(root, "public");
  await mkdir(lessonsDir);
  await mkdir(publicDir);
  await writeFile(path.join(publicDir, "index.html"), "LESSON_APP");

  const splunkBackend = http.createServer((_req, res) => {
    res.end("SPLUNK_LOCALTEST_BACKEND");
  });
  t.after(() => splunkBackend.close());
  const splunkPort = await listen(splunkBackend);

  const server = http.createServer(
    createApp({
      labRoot: root,
      lessonsDir,
      publicDir,
      splunkTarget: `http://127.0.0.1:${splunkPort}`,
    }),
  );
  t.after(() => server.close());
  const port = await listen(server);

  const response = await requestWithHost(port, "splunk.localtest.me:3000");

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, "SPLUNK_LOCALTEST_BACKEND");
});

test("host-based Splunk proxy rewrites internal Splunk redirects", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "splunk-redirect-"));
  const lessonsDir = path.join(root, "lessons");
  const publicDir = path.join(root, "public");
  await mkdir(lessonsDir);
  await mkdir(publicDir);
  await writeFile(path.join(publicDir, "index.html"), "LESSON_APP");

  const splunkBackend = http.createServer((_req, res) => {
    res.statusCode = 302;
    res.setHeader("location", "http://127.0.0.1:65530/en-US/account/login");
    res.end();
  });
  t.after(() => splunkBackend.close());
  const splunkPort = await listen(splunkBackend);

  const server = http.createServer(
    createApp({
      labRoot: root,
      lessonsDir,
      publicDir,
      splunkTarget: `http://127.0.0.1:${splunkPort}`,
    }),
  );
  t.after(() => server.close());
  const port = await listen(server);

  const response = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/",
        headers: { host: "splunk.localhost:3000" },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res));
      },
    );
    req.on("error", reject);
    req.end();
  });

  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, "http://splunk.localhost:3000/en-US/account/login");
});

test("host-based Splunk proxy rewrites redirects to same-site localtest.me host", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "splunk-localtest-redirect-"));
  const lessonsDir = path.join(root, "lessons");
  const publicDir = path.join(root, "public");
  await mkdir(lessonsDir);
  await mkdir(publicDir);
  await writeFile(path.join(publicDir, "index.html"), "LESSON_APP");

  const splunkBackend = http.createServer((_req, res) => {
    res.statusCode = 302;
    res.setHeader("location", "http://127.0.0.1:65530/en-US/account/login");
    res.end();
  });
  t.after(() => splunkBackend.close());
  const splunkPort = await listen(splunkBackend);

  const server = http.createServer(
    createApp({
      labRoot: root,
      lessonsDir,
      publicDir,
      splunkTarget: `http://127.0.0.1:${splunkPort}`,
    }),
  );
  t.after(() => server.close());
  const port = await listen(server);

  const response = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/",
        headers: { host: "splunk.localtest.me:3000" },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res));
      },
    );
    req.on("error", reject);
    req.end();
  });

  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, "http://splunk.localtest.me:3000/en-US/account/login");
});

test("path Splunk proxy rewrites cookie paths for same-origin embedding", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "splunk-cookie-path-"));
  const lessonsDir = path.join(root, "lessons");
  const publicDir = path.join(root, "public");
  await mkdir(lessonsDir);
  await mkdir(publicDir);
  await writeFile(path.join(publicDir, "index.html"), "LESSON_APP");

  const splunkBackend = http.createServer((_req, res) => {
    res.setHeader("set-cookie", [
      "session_id_8000=abc; Path=/; HttpOnly",
      "cval=123; Path=/en-US/account/",
    ]);
    res.end("LOGIN");
  });
  t.after(() => splunkBackend.close());
  const splunkPort = await listen(splunkBackend);

  const server = http.createServer(
    createApp({
      labRoot: root,
      lessonsDir,
      publicDir,
      splunkTarget: `http://127.0.0.1:${splunkPort}`,
    }),
  );
  t.after(() => server.close());
  const port = await listen(server);

  const response = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/splunk/en-US/account/login",
        headers: { host: "learn.localtest.me:3000" },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res));
      },
    );
    req.on("error", reject);
    req.end();
  });

  assert.deepEqual(response.headers["set-cookie"], [
    "session_id_8000=abc; Path=/splunk; HttpOnly",
    "cval=123; Path=/splunk/en-US/account",
  ]);
});

test("path Splunk proxy does not double-prefix Splunk cookie paths", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "splunk-cookie-double-prefix-"));
  const lessonsDir = path.join(root, "lessons");
  const publicDir = path.join(root, "public");
  await mkdir(lessonsDir);
  await mkdir(publicDir);
  await writeFile(path.join(publicDir, "index.html"), "LESSON_APP");

  const splunkBackend = http.createServer((_req, res) => {
    res.setHeader("set-cookie", [
      "cval=already; Path=/splunk/en-US/account/",
      "splunkweb_uid=already; Path=/splunk/en-US/account",
    ]);
    res.end("LOGIN");
  });
  t.after(() => splunkBackend.close());
  const splunkPort = await listen(splunkBackend);

  const server = http.createServer(
    createApp({
      labRoot: root,
      lessonsDir,
      publicDir,
      splunkTarget: `http://127.0.0.1:${splunkPort}`,
    }),
  );
  t.after(() => server.close());
  const port = await listen(server);

  const response = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/splunk/en-US/account/login",
        headers: { host: "learn.localtest.me:3000" },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res));
      },
    );
    req.on("error", reject);
    req.end();
  });

  assert.deepEqual(response.headers["set-cookie"], [
    "cval=already; Path=/splunk/en-US/account",
    "splunkweb_uid=already; Path=/splunk/en-US/account",
  ]);
});

test("path Splunk proxy preserves prefix for Splunk-generated asset URLs", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "splunk-prefix-path-"));
  const lessonsDir = path.join(root, "lessons");
  const publicDir = path.join(root, "public");
  await mkdir(lessonsDir);
  await mkdir(publicDir);
  await writeFile(path.join(publicDir, "index.html"), "LESSON_APP");

  let backendUrl = "";
  const splunkBackend = http.createServer((req, res) => {
    backendUrl = req.url;
    res.end("CONFIG");
  });
  t.after(() => splunkBackend.close());
  const splunkPort = await listen(splunkBackend);

  const server = http.createServer(
    createApp({
      labRoot: root,
      lessonsDir,
      publicDir,
      splunkTarget: `http://127.0.0.1:${splunkPort}`,
    }),
  );
  t.after(() => server.close());
  const port = await listen(server);

  await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/splunk/en-US/config?autoload=1",
        headers: { host: "learn.localtest.me:3000" },
      },
      (res) => {
        res.resume();
        res.on("end", resolve);
      },
    );
    req.on("error", reject);
    req.end();
  });

  assert.equal(backendUrl, "/splunk/en-US/config?autoload=1");
});

test("cockpit page clears stale legacy Splunk cookies", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "splunk-cookie-clear-"));
  const lessonsDir = path.join(root, "lessons");
  const publicDir = path.join(root, "public");
  await mkdir(lessonsDir);
  await mkdir(publicDir);
  await writeFile(path.join(publicDir, "index.html"), "LESSON_APP");

  const server = http.createServer(createApp({ labRoot: root, lessonsDir, publicDir }));
  t.after(() => server.close());
  const port = await listen(server);

  const response = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/",
        headers: { host: "learn.localtest.me:3000" },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res));
      },
    );
    req.on("error", reject);
    req.end();
  });

  const cookies = response.headers["set-cookie"] || [];
  assert.equal(response.headers["cache-control"], "no-store");
  assert.ok(cookies.some((cookie) => cookie.startsWith("cval=; Path=/en-US/account;")));
  assert.ok(cookies.some((cookie) => cookie.startsWith("splunkweb_uid=; Path=/;")));
  assert.ok(cookies.some((cookie) => cookie.startsWith("splunkd_8000=; Path=/;")));
});

test("Splunk proxy responses do not clear active prefixed cookies", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "splunk-prefixed-cookie-"));
  const lessonsDir = path.join(root, "lessons");
  const publicDir = path.join(root, "public");
  await mkdir(lessonsDir);
  await mkdir(publicDir);
  await writeFile(path.join(publicDir, "index.html"), "LESSON_APP");

  const splunkBackend = http.createServer((_req, res) => {
    res.setHeader("set-cookie", "cval=active; Path=/en-US/account/");
    res.end("LOGIN");
  });
  t.after(() => splunkBackend.close());
  const splunkPort = await listen(splunkBackend);

  const server = http.createServer(
    createApp({
      labRoot: root,
      lessonsDir,
      publicDir,
      splunkTarget: `http://127.0.0.1:${splunkPort}`,
    }),
  );
  t.after(() => server.close());
  const port = await listen(server);

  const response = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/splunk/en-US/account/login",
        headers: { host: "learn.localtest.me:3000" },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res));
      },
    );
    req.on("error", reject);
    req.end();
  });

  assert.deepEqual(response.headers["set-cookie"], ["cval=active; Path=/splunk/en-US/account"]);
});

test("Splunk pane reset clears prefixed cookies before redirecting to login", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "splunk-pane-reset-"));
  const lessonsDir = path.join(root, "lessons");
  const publicDir = path.join(root, "public");
  await mkdir(lessonsDir);
  await mkdir(publicDir);
  await writeFile(path.join(publicDir, "index.html"), "LESSON_APP");

  const server = http.createServer(createApp({ labRoot: root, lessonsDir, publicDir }));
  t.after(() => server.close());
  const port = await listen(server);

  const response = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/splunk/reset",
        headers: { host: "learn.localtest.me:3000" },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res));
      },
    );
    req.on("error", reject);
    req.end();
  });

  const cookies = response.headers["set-cookie"] || [];
  assert.equal(response.statusCode, 303);
  assert.equal(
    response.headers.location,
    "/splunk/en-US/account/login?return_to=%2Fsplunk%2Fen-US%2Fapp%2Flauncher%2Fhome",
  );
  assert.equal(response.headers["cache-control"], "no-store");
  assert.ok(cookies.some((cookie) => cookie.startsWith("cval=; Path=/splunk/en-US/account;")));
  assert.ok(cookies.some((cookie) => cookie.startsWith("splunkd_8000=; Path=/splunk;")));
  assert.ok(cookies.some((cookie) => cookie.includes("Domain=.localtest.me")));
});

test("command API rejects commands outside the allow-list", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "splunk-commands-"));
  const lessonsDir = path.join(root, "lessons");
  const publicDir = path.join(root, "public");
  await mkdir(lessonsDir);
  await mkdir(publicDir);
  await writeFile(path.join(publicDir, "index.html"), "lesson app");

  const server = http.createServer(
    createApp({ labRoot: root, lessonsDir, publicDir, splunkPassword: "TopSecret123!" }),
  );
  t.after(() => server.close());
  const port = await listen(server);

  const { response, body } = await fetchJson(`http://127.0.0.1:${port}/api/commands/nope`, {
    method: "POST",
  });

  assert.equal(response.status, 404);
  assert.equal(body.error, "Unknown command");
});
