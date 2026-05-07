import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");

function waitFor(assertion, timeoutMs = 1000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      try {
        resolve(assertion());
      } catch (error) {
        if (Date.now() - started > timeoutMs) {
          reject(error);
          return;
        }
        setTimeout(check, 20);
      }
    };
    check();
  });
}

test("browser app replaces Loading lessons with the first lesson", async () => {
  const html = await readFile(path.join(publicDir, "index.html"), "utf-8");
  const dom = new JSDOM(html, {
    url: "http://localhost:3000/",
    runScripts: "outside-only",
  });

  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.queueMicrotask = queueMicrotask;
  globalThis.fetch = async (url) => {
    if (url === "/api/lessons") {
      return {
        ok: true,
        json: async () => ({
          lessons: [{ id: "00-topology", title: "topology", file: "00-topology.md" }],
        }),
      };
    }
    if (url === "/api/lessons/00-topology") {
      return {
        ok: true,
        json: async () => ({
          html: "<h1>Lesson 00: Topology</h1><p>Loaded.</p>",
        }),
      };
    }
    if (url === "/api/commands") {
      return {
        ok: true,
        json: async () => ({
          commands: [{ id: "validate", label: "Run full lab validation" }],
        }),
      };
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  await import(`${pathToFileURL(path.join(publicDir, "app.js")).href}?test=${Date.now()}`);

  await waitFor(() => {
    const content = dom.window.document.querySelector("#lesson-content").textContent;
    assert.match(content, /Lesson 00: Topology/);
    assert.doesNotMatch(content, /Loading lessons/);
  });
});

test("browser app adds lab-guide copy buttons to lesson code blocks", async () => {
  const html = await readFile(path.join(publicDir, "index.html"), "utf-8");
  const dom = new JSDOM(html, {
    url: "http://localhost:3000/",
    runScripts: "outside-only",
  });
  const copied = [];

  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.queueMicrotask = queueMicrotask;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: { writeText: async (value) => copied.push(value) } },
  });
  globalThis.fetch = async (url) => {
    if (url === "/api/lessons") {
      return {
        ok: true,
        json: async () => ({
          lessons: [{ id: "00-topology", title: "topology", file: "00-topology.md" }],
        }),
      };
    }
    if (url === "/api/lessons/00-topology") {
      return {
        ok: true,
        json: async () => ({ html: '<pre><code class="language-spl">index=lab_file | head 5</code></pre>' }),
      };
    }
    if (url === "/api/commands") {
      return { ok: true, json: async () => ({ commands: [] }) };
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  await import(`${pathToFileURL(path.join(publicDir, "app.js")).href}?test=${Date.now()}`);

  await waitFor(() => {
    assert.ok(dom.window.document.querySelector(".guide-code-block"));
    assert.equal(dom.window.document.querySelector(".copy-btn").textContent, "Copy");
  });

  dom.window.document.querySelector(".copy-btn").click();
  await waitFor(() => assert.deepEqual(copied, ["index=lab_file | head 5"]));
});

test("browser app embeds Splunk panes on same-origin paths", async () => {
  const html = await readFile(path.join(publicDir, "index.html"), "utf-8");

  assert.doesNotMatch(html, /data-view="architecture">Architecture/);
  assert.match(html, /data-view="splunk">Indexer\/Search Head/);
  assert.match(html, /class="credential-pill"/);
  assert.match(html, /id="lab-status-strip" class="lab-status-strip"/);
  assert.match(html, /Login: <strong>admin<\/strong> \/ <strong>\{\{SPLUNK_PASSWORD\}\}<\/strong>/);
  assert.ok(html.indexOf('class="credential-pill"') < html.indexOf('data-view="splunk"'));
  assert.match(html, /src="\/splunk\/reset"/);
  assert.match(html, /src="\/deployment\/reset"/);
  assert.match(html, /src="\/heavy\/reset"/);
  assert.match(html, /class="tab active" data-view="splunk"/);
  assert.match(html, /class="workspace-frame active" id="view-splunk"/);
  assert.match(html, /class="workspace-frame terminal" id="view-terminal"/);
  assert.doesNotMatch(html, /http:\/\/splunk\.localtest\.me:3000/);
  assert.doesNotMatch(html, /http:\/\/splunk\.localhost:3000/);
});

test("browser app exposes a guided journey shell and OS-aware theme picker", async () => {
  const html = await readFile(path.join(publicDir, "index.html"), "utf-8");

  assert.match(html, /<html lang="en" data-theme="system">/);
  assert.match(html, /class="theme-picker"/);
  assert.match(html, /<option value="system">System<\/option>/);
  assert.match(html, /<option value="dark">Dark<\/option>/);
  assert.match(html, /<option value="light">Light<\/option>/);
  assert.match(html, /class="guide-nav"/);
  assert.match(html, /Learning Journey/);
  assert.match(html, /<span class="step-num">1<\/span><span>Start Here<\/span>/);
  assert.match(html, /Log Into Splunk/);
  assert.match(html, /Your Learn Splunk Journey/);
  assert.match(html, /Step 1/);
  assert.match(html, /Explore The Lab Topology/);
  assert.match(html, /Explore Data/);
  assert.match(html, /Create Dashboards/);
  assert.match(html, /Use Tools \(MCP\)/);
  assert.match(html, /Search The Lab's Indexes, Sources, And Sourcetypes/);
  assert.match(html, /Turn Lab Searches Into Visual Panels/);
  assert.match(html, /Lesson Modules/);
  assert.match(html, /Coming Soon/);
  assert.match(html, /Quizzes/);
  assert.match(html, /Progress Checks/);
});

test("browser app uses Learn Splunk as the primary project name", async () => {
  const html = await readFile(path.join(publicDir, "index.html"), "utf-8");

  assert.match(html, /<title>Learn Splunk<\/title>/);
  assert.match(html, /<strong>Learn Splunk<\/strong>/);
  assert.doesNotMatch(html, /Splunk Learn Forwarding/);
});

test("browser app opens on a visual Splunk architecture landing page", async () => {
  const html = await readFile(path.join(publicDir, "index.html"), "utf-8");

  assert.match(html, /class="architecture-pane guide-section"/);
  assert.match(html, /class="architecture-map"/);
  assert.match(html, /class="tips-panel guide-section"/);
  assert.match(html, /class="mcp-panel guide-section"/);
  assert.doesNotMatch(html, /id="view-architecture"/);
  assert.match(html, /<pre id="command-output">Pick a command to run\.<\/pre>[\s\S]*<h2>Lab CLI<\/h2>/);
  assert.doesNotMatch(html, /Forwarding Lab Topology/);
  assert.doesNotMatch(html, /Lab Wrapper/);
  assert.doesNotMatch(html, /wraps guided lessons, Splunk panes, Lab CLI, and the topology map/);
  assert.match(html, /sample-log-source/);
  assert.match(html, /Universal Forwarder/);
  assert.match(html, /Deployment Server/);
  assert.match(html, /Deployment server configuration files/);
  assert.match(html, /Heavy Forwarder/);
  assert.match(html, /Search \+ Index Tier/);
  assert.match(html, /class="destination-tiers"/);
  assert.match(html, /class="nested-tier splunk-enterprise-tier"/);
  assert.match(html, /Splunk Enterprise/);
  assert.match(html, /Search Function/);
  assert.match(html, /data-command="topologySearchHead"/);
  assert.match(html, /Search function configuration files/);
  assert.match(html, /Index Function/);
  assert.match(html, /data-command="topologyIndexer"/);
  assert.match(html, /Index function configuration files/);
  assert.match(html, /class="nested-tier splunk-cloud-tier"/);
  assert.match(html, /Splunk Cloud Tier/);
  assert.match(html, /Optional Cloud Destination/);
  assert.match(html, /data-command="topologySplunkCloud"/);
  assert.match(html, /Splunk Cloud/);
  assert.match(html, /HF can route selected inputs to Splunk Cloud using cloud-provided forwarding outputs/);
  assert.match(html, /Splunk Cloud forwarding configuration files/);
  assert.match(html, /Data Source Tier/);
  assert.match(html, /File Example/);
  assert.match(html, /TCP Example/);
  assert.match(html, /UDP Example/);
  assert.match(html, /JSON Example/);
  assert.match(html, /OpenTelemetry Example/);
  assert.match(html, /XML Example/);
  assert.match(html, /HEC Example/);
  assert.match(html, /Scripted Example/);
  assert.match(html, /Masked PII Example/);
  assert.match(html, /Buttercup App Example/);
  assert.match(html, /data-command="dataSourceFile"/);
  assert.match(html, /data-command="dataSourceTcp"/);
  assert.match(html, /data-command="dataSourceUdp"/);
  assert.match(html, /data-command="dataSourceJson"/);
  assert.match(html, /data-command="dataSourceOtel"/);
  assert.match(html, /data-command="dataSourceXml"/);
  assert.match(html, /data-command="dataSourceHec"/);
  assert.match(html, /data-command="dataSourceScripted"/);
  assert.match(html, /data-command="dataSourceMasked"/);
  assert.match(html, /data-command="dataSourceButtercup"/);
  assert.match(html, /structured-json-source/);
  assert.match(html, /open-telemetry-source/);
  assert.match(html, /structured-xml-source/);
  assert.match(html, /http-event-collector-source/);
  assert.match(html, /Splunk HTTP Event Collector/);
  assert.match(html, /Python and bash scripts run as Splunk scripted inputs/);
  assert.match(html, /HF applies regex masking before data is stored/);
  assert.match(html, /emits OTLP-style JSON records with traces, spans, resources, and attributes/);
  assert.match(html, /bundled web, sales, and product sample data indexed by Splunk Enterprise/);
  for (const value of [
    "queries dedicated source indexes",
    "index=lab_file",
    "source=/var/log/lab/app.log",
    "sourcetype=lab:app",
    "config=inputs.conf",
    "index=lab_tcp",
    "source=tcp:1514",
    "sourcetype=lab:tcp",
    "index=lab_udp",
    "source=udp:1515",
    "sourcetype=lab:udp",
    "index=lab_json",
    "source=/var/log/lab/events.json",
    "sourcetype=lab:json",
    "config=inputs.conf, props.conf",
    "index=lab_otel",
    "source=/var/log/lab/otel.json",
    "sourcetype=lab:otel",
    "index=lab_xml",
    "source=/var/log/lab/events.xml",
    "sourcetype=lab:xml",
    "index=lab_hec",
    "source=http-event-collector-source",
    "sourcetype=lab:hec",
    "config=HEC input, props.conf",
    "index=lab_scripted",
    "source=TA_scripted_inputs/bin/*",
    "sourcetype=lab:scripted:python, lab:scripted:bash",
    "config=inputs.conf, props.conf, bin/*",
    "index=lab_masked",
    "source=/var/log/lab/pii.log",
    "sourcetype=lab:masked",
    "config=inputs.conf, props.conf, transforms.conf",
    "index=buttercup",
    "source=buttercup_app/data/*",
    "sourcetype=buttercup_web, buttercup_sales, buttercup_products",
    "config=app.conf, inputs.conf, props.conf, indexes.conf",
  ]) {
    assert.match(html, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(html, /Collection Tier/);
  assert.match(html, /Universal Forwarder Direct Path/);
  assert.match(html, /data-command="topologyUfDirect"/);
  assert.match(html, /Direct universal forwarder configuration files/);
  assert.match(html, /Universal Forwarder Via HF Path/);
  assert.match(html, /data-command="topologyUfViaHeavy"/);
  assert.match(html, /Via-heavy universal forwarder configuration files/);
  assert.match(html, /universal-forwarder-via-heavy/);
  assert.match(html, /Heavy Forwarder \/ Parsing/);
  assert.match(html, /data-command="topologyHeavyForwarder"/);
  assert.match(html, /Heavy forwarder configuration files/);
  assert.match(html, /collects file\/TCP\/UDP inputs and forwards upstream/);
  assert.match(html, /collects file\/TCP\/UDP inputs and forwards to HF/);
  assert.match(html, /props.conf parsing can happen here; outputs.conf can route data to Enterprise, Cloud, or both/);
  assert.match(html, /props\.conf \+ transforms\.conf for parsing and masking/);
  assert.match(html, /indexes\.conf for source-specific indexes/);
  assert.match(html, /serverclass\.conf/);
  assert.match(html, /deploymentclient\.conf/);
  assert.match(html, /transforms\.conf/);
  assert.match(html, /regex transforms/);
  assert.match(html, /UF forwards upstream/);
  assert.match(html, /UF forwards to HF/);
  assert.doesNotMatch(html, /file\/TCP\/UDP inputs → outputs to indexer/);
  assert.doesNotMatch(html, /UF → Indexer/);
  assert.doesNotMatch(html, /HF → Indexer/);
  const collectionSection = html.slice(
    html.indexOf('<section class="tier collection-tier">'),
    html.indexOf('<div class="vertical-flow ingest">file, tcp, udp, json, otel, xml, hec, scripted, masked pii, buttercup app inputs</div>'),
  );
  assert.doesNotMatch(collectionSection, /indexer/i);
  assert.ok(collectionSection.indexOf("heavy-forwarder") < collectionSection.indexOf("universal-forwarder-via-heavy"));
  assert.match(html, /Management/);
  assert.ok(html.indexOf("Management") < html.indexOf("Search + Index Tier"));
  assert.ok(html.indexOf("Collection Tier") < html.indexOf("Data Source Tier"));
  assert.ok(html.indexOf("Data Source Tier") < html.indexOf('id="section-forwarding-paths"'));
  assert.match(html, /inputs\.conf/);
  assert.match(html, /outputs\.conf/);
  assert.match(html, /props\.conf/);
  assert.match(html, /Turn Lab Searches Into Visual Panels/);
  assert.match(html, /Find A Question/);
  assert.match(html, /Shape The SPL/);
  assert.match(html, /Choose A Visualization/);
  assert.match(html, /Save A Panel/);
  assert.match(html, /Explain The Data/);
  assert.doesNotMatch(html, /Search Tier/);
  assert.doesNotMatch(html, /Indexing Tier/);
  assert.doesNotMatch(html, /src="\/reference\/splunk_arch\.png"/);
  assert.doesNotMatch(html, /src="\/reference\/splunk_dist\.png"/);
});

test("browser app loads guide sections into one main window", async () => {
  const html = await readFile(path.join(publicDir, "index.html"), "utf-8");

  assert.match(html, /class="overview-panel guide-section active"/);
  assert.match(html, /class="architecture-pane guide-section"/);
  assert.match(html, /class="data-source-panel guide-section"/);
  assert.match(html, /class="workspace"/);
  assert.doesNotMatch(html, /class="workspace guide-section"/);
  assert.match(html, /class="tips-panel guide-section"/);
  assert.match(html, /class="status-panel guide-section"/);
  assert.match(html, /class="mcp-panel guide-section"/);
  assert.match(html, /class="docs-panel guide-section"/);
  assert.match(html, /class="instructions guide-section"/);
  assert.match(html, /class="parsing-panel guide-section"/);
  assert.match(html, /Search The Lab's Indexes, Sources, And Sourcetypes/);
  assert.match(html, /<header class="lesson-heading">/);
  assert.match(html, /<h1>Lesson Modules<\/h1>/);
  assert.match(html, /id="lesson-list" class="lesson-list module-row"/);
});

test("browser app documents the Learn Splunk MCP integration", async () => {
  const html = await readFile(path.join(publicDir, "index.html"), "utf-8");

  assert.match(html, /aria-label="MCP and Ask Splunk integration"/);
  assert.match(html, /Ask Splunk With Safe Local Tools/);
  assert.match(html, /What can I ask/);
  assert.match(html, /Chat placeholder/);
  assert.match(html, /MCP setup tabs/);
  assert.match(html, /Claude Desktop/);
  assert.match(html, /learn-splunk/);
  assert.match(html, /http:\/\/localhost:8050\/mcp/);
  assert.match(html, /search_oneshot/);
  assert.match(html, /get_indexes/);
  assert.match(html, /index=lab_otel sourcetype=lab:otel \| head 5/);
  assert.match(html, /index=buttercup sourcetype=buttercup_sales/);
  assert.match(html, /index=lab_hec sourcetype=lab:hec/);
  assert.match(html, /Do not expose port 8050 beyond localhost/);
  assert.match(html, /class="mcp-explorer"/);
  assert.match(html, /Explore MCP Tools/);
  assert.match(html, /data-mcp-query="index=lab_otel sourcetype=lab:otel \| head 5"/);
  assert.match(html, /id="mcp-tool-list"/);
  assert.match(html, /id="mcp-tool-form"/);
  assert.match(html, /id="mcp-result"/);
});

test("browser app renders full lab status diagnostics", async () => {
  const html = await readFile(path.join(publicDir, "index.html"), "utf-8");

  assert.match(html, /class="status-panel guide-section"/);
  assert.match(html, /Live Lab Diagnostics/);
  assert.match(html, /id="status-summary-text"/);
  assert.match(html, /id="status-last-updated"/);
  assert.match(html, /id="status-detail-list"/);
});

test("browser app supports guide navigation and manual theme selection", async () => {
  const html = await readFile(path.join(publicDir, "index.html"), "utf-8");
  const dom = new JSDOM(html, {
    url: "http://localhost:3000/",
    runScripts: "outside-only",
  });

  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.queueMicrotask = queueMicrotask;
  globalThis.fetch = async (url) => {
    if (url === "/api/lessons") {
      return { ok: true, json: async () => ({ lessons: [] }) };
    }
    if (url === "/api/commands") {
      return { ok: true, json: async () => ({ commands: [] }) };
    }
    if (url === "/api/lab/status") {
      return { ok: true, json: async () => ({ services: [] }) };
    }
    if (url === "/api/mcp/tools") {
      return { ok: true, json: async () => ({ tools: [] }) };
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  await import(`${pathToFileURL(path.join(publicDir, "app.js")).href}?test=${Date.now()}`);

  assert.equal(dom.window.document.querySelector("#section-start-here").classList.contains("active"), true);
  assert.equal(dom.window.document.querySelector("#view-splunk").classList.contains("active"), true);
  assert.equal(dom.window.document.querySelector('[data-view="splunk"]').classList.contains("active"), true);
  assert.equal(dom.window.document.querySelector("#view-terminal").classList.contains("active"), false);

  assert.equal(dom.window.document.documentElement.dataset.theme, "system");
  const themeSelect = dom.window.document.querySelector("#theme-mode");
  themeSelect.value = "dark";
  themeSelect.dispatchEvent(new dom.window.Event("change"));
  assert.equal(dom.window.document.documentElement.dataset.theme, "dark");
  assert.equal(dom.window.localStorage.getItem("learn-splunk-theme"), "dark");

  dom.window.document.querySelector('[data-section="lab-topology"].guide-nav-item').click();
  assert.equal(dom.window.document.querySelector("#section-lab-topology").classList.contains("active"), true);
  assert.equal(dom.window.document.querySelector("#view-terminal").classList.contains("active"), true);
  assert.equal(dom.window.document.querySelector('[data-view="terminal"]').classList.contains("active"), true);
  assert.equal(dom.window.document.querySelector("#view-splunk").classList.contains("active"), false);

  dom.window.document.querySelector('[data-section="mcp-ask"].guide-nav-item').click();
  assert.equal(
    dom.window.document.querySelector('[data-section="mcp-ask"].guide-nav-item').classList.contains("active"),
    true,
  );
  assert.equal(dom.window.document.querySelector("#section-mcp-ask").classList.contains("active"), true);
  assert.equal(dom.window.document.querySelector("#section-start-here").classList.contains("active"), false);
  assert.match(dom.window.document.querySelector("#guide-progress").textContent, /Step 5 of 9/);
});

test("browser app leaves the header status strip blank when all containers are ok", async () => {
  const html = await readFile(path.join(publicDir, "index.html"), "utf-8");
  const dom = new JSDOM(html, {
    url: "http://localhost:3000/",
    runScripts: "outside-only",
  });

  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.queueMicrotask = queueMicrotask;
  globalThis.fetch = async (url) => {
    if (url === "/api/lessons") {
      return { ok: true, json: async () => ({ lessons: [] }) };
    }
    if (url === "/api/commands") {
      return { ok: true, json: async () => ({ commands: [] }) };
    }
    if (url === "/api/lab/status") {
      return {
        ok: true,
        json: async () => ({
          services: [
            { name: "lesson-web", status: "ok", containerStatus: "Up 2 minutes" },
            { name: "splunk-indexer", status: "ok", containerStatus: "Up 2 minutes" },
          ],
        }),
      };
    }
    if (url === "/api/mcp/tools") {
      return { ok: true, json: async () => ({ tools: [] }) };
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  await import(`${pathToFileURL(path.join(publicDir, "app.js")).href}?test=${Date.now()}`);

  await waitFor(() => {
    assert.match(dom.window.document.querySelector("#status-summary-text").textContent, /2\/2 services healthy/);
  });
  assert.equal(dom.window.document.querySelector("#lab-status-strip").textContent, "");
});

test("browser app loads curated MCP tools and runs selected tool", async () => {
  const html = await readFile(path.join(publicDir, "index.html"), "utf-8");
  const dom = new JSDOM(html, {
    url: "http://localhost:3000/",
    runScripts: "outside-only",
  });
  const calls = [];

  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.queueMicrotask = queueMicrotask;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === "/api/lessons") {
      return { ok: true, json: async () => ({ lessons: [] }) };
    }
    if (url === "/api/commands") {
      return { ok: true, json: async () => ({ commands: [] }) };
    }
    if (url === "/api/lab/status") {
      return {
        ok: true,
        json: async () => ({
          services: [
            {
              name: "splunk-mcp",
              status: "ok",
              containerStatus: "Up 2 minutes",
              state: "running",
              httpStatus: 200,
              latencyMs: 7,
            },
            {
              name: "universal-forwarder",
              status: "ok",
              containerStatus: "Up 2 minutes",
              state: "running",
              httpStatus: null,
              latencyMs: null,
            },
            {
              name: "deployment-server",
              status: "down",
              containerStatus: "Exited (2) 1 minute ago",
              state: "exited",
              httpStatus: null,
              latencyMs: null,
            },
          ],
        }),
      };
    }
    if (url === "/api/mcp/tools") {
      return {
        ok: true,
        json: async () => ({
          tools: [
            {
              name: "validate_spl",
              description: "Validate SPL",
              inputSchema: {
                properties: {
                  query: { type: "string", description: "SPL query" },
                },
              },
            },
          ],
        }),
      };
    }
    if (url === "/api/mcp/tools/call") {
      return { ok: true, json: async () => ({ tool: "validate_spl", result: { content: [] } }) };
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  await import(`${pathToFileURL(path.join(publicDir, "app.js")).href}?test=${Date.now()}`);

  await waitFor(() => {
    assert.match(dom.window.document.querySelector("#mcp-tool-list").textContent, /validate_spl/);
    assert.ok(dom.window.document.querySelector('[name="query"]'));
    assert.match(dom.window.document.querySelector("#lab-status-strip").textContent, /Lab warning: 1 container need attention/);
    assert.doesNotMatch(dom.window.document.querySelector("#lab-status-strip").textContent, /splunk-mcp: ok/);
    assert.match(dom.window.document.querySelector("#lab-status-strip span").title, /deployment-server: down/);
    assert.match(dom.window.document.querySelector("#status-summary-text").textContent, /2\/3 services healthy/);
    assert.match(dom.window.document.querySelector("#status-detail-list").textContent, /splunk-mcp/);
    assert.match(dom.window.document.querySelector("#status-detail-list").textContent, /universal-forwarder/);
    assert.match(dom.window.document.querySelector("#status-detail-list").textContent, /deployment-server/);
    assert.match(dom.window.document.querySelector("#status-detail-list").textContent, /Container: Up 2 minutes/);
  });

  dom.window.document.querySelector('[name="query"]').value = "index=lab_file | head 1";
  dom.window.document.querySelector("#mcp-run-tool").click();

  await waitFor(() => {
    assert.match(dom.window.document.querySelector("#mcp-result").textContent, /validate_spl/);
  });
  assert.ok(calls.some((call) => call.url === "/api/mcp/tools/call" && call.options.method === "POST"));
});

test("browser app opens topology and data source cards in the Lab CLI pane", async () => {
  const html = await readFile(path.join(publicDir, "index.html"), "utf-8");
  const dom = new JSDOM(html, {
    url: "http://localhost:3000/",
    runScripts: "outside-only",
  });
  const calls = [];

  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.queueMicrotask = queueMicrotask;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method || "GET" });
    if (url === "/api/lessons") {
      return {
        ok: true,
        json: async () => ({
          lessons: [{ id: "00-topology", title: "topology", file: "00-topology.md" }],
        }),
      };
    }
    if (url === "/api/lessons/00-topology") {
      return {
        ok: true,
        json: async () => ({ html: "<h1>Lesson 00: Topology</h1>" }),
      };
    }
    if (url === "/api/commands") {
      return {
        ok: true,
        json: async () => ({
          commands: [
            { id: "dataSourceJson", label: "Data source: JSON file input config" },
            { id: "topologyHeavyForwarder", label: "Topology function: Heavy Forwarder configs" },
          ],
        }),
      };
    }
    if (url === "/api/commands/dataSourceJson") {
      return {
        ok: true,
        json: async () => ({ ok: true, exitCode: 0, stdout: "JSON config", stderr: "" }),
      };
    }
    if (url === "/api/commands/topologyHeavyForwarder") {
      return {
        ok: true,
        json: async () => ({ ok: true, exitCode: 0, stdout: "Heavy Forwarder configs", stderr: "" }),
      };
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  await import(`${pathToFileURL(path.join(publicDir, "app.js")).href}?test=${Date.now()}`);

  await waitFor(() => {
    assert.ok(dom.window.document.querySelector('[data-command="dataSourceJson"]'));
  });
  dom.window.document.querySelector('[data-section="lab-topology"].guide-nav-item').click();
  assert.equal(dom.window.document.querySelector("#section-lab-topology").classList.contains("active"), true);

  dom.window.document.querySelector('[data-command="dataSourceJson"]').click();

  await waitFor(() => {
    assert.equal(dom.window.document.querySelector("#section-lab-topology").classList.contains("active"), true);
    assert.equal(dom.window.document.querySelector("#section-data-sources").classList.contains("active"), false);
    assert.equal(dom.window.document.querySelector(".workspace").classList.contains("active"), false);
    assert.equal(dom.window.document.querySelector("#view-terminal").classList.contains("active"), true);
    assert.equal(dom.window.document.querySelector('[data-view="terminal"]').classList.contains("active"), true);
    assert.match(dom.window.document.querySelector("#command-output").textContent, /JSON config/);
  });
  assert.ok(
    calls.some((call) => call.url === "/api/commands/dataSourceJson" && call.method === "POST"),
  );

  dom.window.document.querySelector('[data-command="topologyHeavyForwarder"]').dispatchEvent(
    new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );

  await waitFor(() => {
    assert.equal(dom.window.document.querySelector("#section-lab-topology").classList.contains("active"), true);
    assert.equal(dom.window.document.querySelector("#view-terminal").classList.contains("active"), true);
    assert.match(dom.window.document.querySelector("#command-output").textContent, /Heavy Forwarder configs/);
  });
  assert.ok(
    calls.some((call) => call.url === "/api/commands/topologyHeavyForwarder" && call.method === "POST"),
  );
});

test("browser app shows lesson modules as a heading row in the lessons pane", async () => {
  const html = await readFile(path.join(publicDir, "index.html"), "utf-8");

  assert.match(html, /<header class="lesson-heading">/);
  assert.match(html, /<h1>Lesson Modules<\/h1>/);
  assert.match(html, /id="lesson-list" class="lesson-list module-row"/);
  assert.match(html, /<section class="instructions guide-section"/);
});
