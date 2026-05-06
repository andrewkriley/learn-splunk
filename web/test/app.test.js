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

test("browser app embeds Splunk panes on same-origin paths", async () => {
  const html = await readFile(path.join(publicDir, "index.html"), "utf-8");

  assert.doesNotMatch(html, /data-view="architecture">Architecture/);
  assert.match(html, /data-view="splunk">Indexer\/Search Head/);
  assert.match(html, /class="credential-pill"/);
  assert.match(html, /Login: <strong>admin<\/strong> \/ <strong>\{\{SPLUNK_PASSWORD\}\}<\/strong>/);
  assert.ok(html.indexOf('class="credential-pill"') < html.indexOf('data-view="splunk"'));
  assert.match(html, /src="\/splunk\/reset"/);
  assert.match(html, /src="\/deployment\/reset"/);
  assert.match(html, /src="\/heavy\/reset"/);
  assert.doesNotMatch(html, /http:\/\/splunk\.localtest\.me:3000/);
  assert.doesNotMatch(html, /http:\/\/splunk\.localhost:3000/);
});

test("browser app opens on a visual Splunk architecture landing page", async () => {
  const html = await readFile(path.join(publicDir, "index.html"), "utf-8");

  assert.match(html, /class="architecture-pane"/);
  assert.match(html, /class="architecture-map"/);
  assert.match(html, /class="cockpit-wrapper"/);
  assert.match(html, /class="tips-panel"/);
  assert.doesNotMatch(html, /id="view-architecture"/);
  assert.match(html, /class="tab active" data-view="terminal"/);
  assert.match(html, /class="workspace-frame terminal active" id="view-terminal"/);
  assert.match(html, /<pre id="command-output">Pick a command to run\.<\/pre>[\s\S]*<h2>Lab CLI<\/h2>/);
  assert.match(html, /Splunk Platform Architecture/);
  assert.match(html, /Lab Wrapper/);
  assert.match(html, /wraps guided lessons, Splunk panes, Lab CLI, and the topology map/);
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
  assert.match(html, /Search function configuration files/);
  assert.match(html, /Index Function/);
  assert.match(html, /Index function configuration files/);
  assert.match(html, /class="nested-tier splunk-cloud-tier"/);
  assert.match(html, /Splunk Cloud Tier/);
  assert.match(html, /Optional Cloud Destination/);
  assert.match(html, /Splunk Cloud/);
  assert.match(html, /HF can route selected inputs to Splunk Cloud using cloud-provided forwarding outputs/);
  assert.match(html, /Splunk Cloud forwarding configuration files/);
  assert.match(html, /outputs.conf can route data to Enterprise, Cloud, or both/);
  assert.match(html, /A single HF can route different inputs to different outputs/);
  assert.match(html, /Separate HFs are optional/);
  assert.match(html, /Data Source Tier/);
  assert.match(html, /File Example/);
  assert.match(html, /TCP Example/);
  assert.match(html, /UDP Example/);
  assert.match(html, /JSON Example/);
  assert.match(html, /XML Example/);
  assert.match(html, /HEC Example/);
  assert.match(html, /Scripted Example/);
  assert.match(html, /Masked PII Example/);
  assert.match(html, /data-command="dataSourceFile"/);
  assert.match(html, /data-command="dataSourceTcp"/);
  assert.match(html, /data-command="dataSourceUdp"/);
  assert.match(html, /data-command="dataSourceJson"/);
  assert.match(html, /data-command="dataSourceXml"/);
  assert.match(html, /data-command="dataSourceHec"/);
  assert.match(html, /data-command="dataSourceScripted"/);
  assert.match(html, /data-command="dataSourceMasked"/);
  assert.match(html, /structured-json-source/);
  assert.match(html, /structured-xml-source/);
  assert.match(html, /http-event-collector-source/);
  assert.match(html, /Splunk HTTP Event Collector/);
  assert.match(html, /Python and bash scripts run as Splunk scripted inputs/);
  assert.match(html, /HF applies regex masking before data is stored/);
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
  ]) {
    assert.match(html, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(html, /Collection Tier/);
  assert.match(html, /Universal Forwarder Direct Path/);
  assert.match(html, /Direct universal forwarder configuration files/);
  assert.match(html, /Universal Forwarder Via HF Path/);
  assert.match(html, /Via-heavy universal forwarder configuration files/);
  assert.match(html, /universal-forwarder-via-heavy/);
  assert.match(html, /Heavy Forwarder \/ Parsing/);
  assert.match(html, /Heavy forwarder configuration files/);
  assert.match(html, /collects file\/TCP\/UDP inputs and forwards upstream/);
  assert.match(html, /collects file\/TCP\/UDP inputs and forwards to HF/);
  assert.match(html, /props.conf parsing can happen here; outputs.conf can route data to Enterprise, Cloud, or both/);
  assert.match(html, /props\.conf \+ transforms\.conf for parsing and masking/);
  assert.match(html, /indexes\.conf for source-specific indexes/);
  assert.match(html, /serverclass\.conf/);
  assert.match(html, /deploymentclient\.conf/);
  assert.match(html, /transforms\.conf/);
  assert.match(html, /regex-based event rewrites/);
  assert.match(html, /UF forwards upstream/);
  assert.match(html, /UF forwards to HF/);
  assert.doesNotMatch(html, /file\/TCP\/UDP inputs → outputs to indexer/);
  assert.doesNotMatch(html, /UF → Indexer/);
  assert.doesNotMatch(html, /HF → Indexer/);
  const collectionSection = html.slice(
    html.indexOf('<section class="tier collection-tier">'),
    html.indexOf('<div class="vertical-flow ingest">file, tcp, udp, json, xml, hec, scripted, masked pii inputs</div>'),
  );
  assert.doesNotMatch(collectionSection, /indexer/i);
  assert.ok(collectionSection.indexOf("heavy-forwarder") < collectionSection.indexOf("universal-forwarder-via-heavy"));
  assert.match(html, /Management/);
  assert.ok(html.indexOf("Management") < html.indexOf("Search + Index Tier"));
  assert.ok(html.indexOf("Lesson Cockpit") < html.indexOf("Search + Index Tier"));
  assert.ok(html.indexOf("Collection Tier") < html.indexOf("Data Source Tier"));
  assert.ok(html.indexOf("Data Source Tier") < html.indexOf("Key Configuration Files"));
  assert.match(html, /inputs\.conf/);
  assert.match(html, /Defines what Splunk reads or listens to/);
  assert.match(html, /Applied on UFs for file, TCP, and UDP inputs/);
  assert.match(html, /outputs\.conf/);
  assert.match(html, /Defines where a forwarder sends events next/);
  assert.match(html, /Applied on the direct UF to send to the indexer/);
  assert.match(html, /props\.conf/);
  assert.match(html, /Defines event parsing behavior/);
  assert.match(html, /Applied where parsing occurs/);
  assert.doesNotMatch(html, /Search Tier/);
  assert.doesNotMatch(html, /Indexing Tier/);
  assert.doesNotMatch(html, /src="\/reference\/splunk_arch\.png"/);
  assert.doesNotMatch(html, /src="\/reference\/splunk_dist\.png"/);
});

test("browser app places lessons below the two primary panes", async () => {
  const html = await readFile(path.join(publicDir, "index.html"), "utf-8");

  assert.ok(html.indexOf('<aside class="architecture-pane">') < html.indexOf('<section class="workspace">'));
  assert.ok(html.indexOf('<section class="workspace">') < html.indexOf('<section class="tips-panel"'));
  assert.ok(html.indexOf('<section class="tips-panel"') < html.indexOf('<section class="instructions">'));
  assert.match(html, /<header class="lesson-heading">/);
  assert.match(html, /<h1>Lesson Modules<\/h1>/);
  assert.match(html, /id="lesson-list" class="lesson-list module-row"/);
});

test("browser app opens data source cards in the Lab CLI pane", async () => {
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
          commands: [{ id: "dataSourceJson", label: "Data source: JSON file input config" }],
        }),
      };
    }
    if (url === "/api/commands/dataSourceJson") {
      return {
        ok: true,
        json: async () => ({ ok: true, exitCode: 0, stdout: "JSON config", stderr: "" }),
      };
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  await import(`${pathToFileURL(path.join(publicDir, "app.js")).href}?test=${Date.now()}`);

  await waitFor(() => {
    assert.ok(dom.window.document.querySelector('[data-command="dataSourceJson"]'));
  });

  dom.window.document.querySelector('[data-command="dataSourceJson"]').click();

  await waitFor(() => {
    assert.equal(dom.window.document.querySelector("#view-terminal").classList.contains("active"), true);
    assert.equal(dom.window.document.querySelector('[data-view="terminal"]').classList.contains("active"), true);
    assert.match(dom.window.document.querySelector("#command-output").textContent, /JSON config/);
  });
  assert.ok(
    calls.some((call) => call.url === "/api/commands/dataSourceJson" && call.method === "POST"),
  );
});

test("browser app shows lesson modules as a heading row in the lessons pane", async () => {
  const html = await readFile(path.join(publicDir, "index.html"), "utf-8");

  assert.match(html, /<header class="lesson-heading">/);
  assert.match(html, /<h1>Lesson Modules<\/h1>/);
  assert.match(html, /id="lesson-list" class="lesson-list module-row"/);
  assert.match(html, /<section class="instructions">/);
});
