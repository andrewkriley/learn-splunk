import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

test("local lab web.conf disables Splunk login cookie probe for embedded HTTP UI", async () => {
  const webConf = await readFile(
    path.join(repoRoot, "splunk/common/apps/lab_web_embedding/default/web.conf"),
    "utf-8",
  );

  assert.match(webConf, /verifyCookiesWorkDuringLogin\s*=\s*false/);
  assert.match(webConf, /tools\.sessions\.secure\s*=\s*false/);
  assert.match(webConf, /x_frame_options_sameorigin\s*=\s*false/);
});

test("Splunk web embedding app is mounted into all Splunk Web services", async () => {
  const compose = await readFile(path.join(repoRoot, "docker-compose.yml"), "utf-8");
  const mount = "./splunk/common/apps/lab_web_embedding:/opt/splunk/etc/apps/lab_web_embedding";
  const occurrences = compose.split(mount).length - 1;

  assert.equal(occurrences, 3);
});

test("compose defines the local Learn Splunk MCP service", async () => {
  const compose = await readFile(path.join(repoRoot, "docker-compose.yml"), "utf-8");
  const mcpConfig = await readFile(path.join(repoRoot, ".mcp.json"), "utf-8");
  const dockerfile = await readFile(path.join(repoRoot, "mcp/Dockerfile"), "utf-8");

  assert.match(compose, /splunk-mcp:/);
  assert.match(compose, /context:\s*\.\/mcp/);
  assert.match(compose, /SPLUNK_HOST:\s*splunk-indexer/);
  assert.match(compose, /SPLUNK_PORT:\s*8089/);
  assert.match(compose, /SPLUNK_PASSWORD:\s*\$\{SPLUNK_PASSWORD:\?Set SPLUNK_PASSWORD in \.env\}/);
  assert.match(compose, /\$\{MCP_BIND_HOST:-127\.0\.0\.1\}:\$\{MCP_PORT:-8050\}:8050/);
  assert.match(compose, /lesson-web:[\s\S]*depends_on:[\s\S]*splunk-mcp/);
  assert.match(mcpConfig, /"learn-splunk"/);
  assert.match(mcpConfig, /"url": "http:\/\/localhost:8050\/mcp"/);
  assert.match(dockerfile, /SPLUNK_MCP_SERVER2_REF=fac6cbb37be057a68607642d8d60d9c19ba5a060/);
});

test("compose avoids clone-specific container names and parameterizes host ports", async () => {
  const compose = await readFile(path.join(repoRoot, "docker-compose.yml"), "utf-8");
  const envExample = await readFile(path.join(repoRoot, ".env.example"), "utf-8");

  assert.match(compose, /name:\s*\$\{COMPOSE_PROJECT_NAME:-learn-splunk\}/);
  assert.doesNotMatch(compose, /container_name:/);
  assert.match(compose, /\$\{LESSON_WEB_PORT:-3000\}:3000/);
  assert.match(compose, /\$\{SPLUNK_WEB_PORT:-8000\}:8000/);
  assert.match(compose, /\$\{DEPLOYMENT_WEB_PORT:-18000\}:8000/);
  assert.match(compose, /\$\{HEAVY_WEB_PORT:-28000\}:8000/);
  assert.match(compose, /COMPOSE_PROJECT_NAME:\s*\$\{COMPOSE_PROJECT_NAME:-learn-splunk\}/);
  assert.match(envExample, /COMPOSE_PROJECT_NAME=learn-splunk/);
  assert.match(envExample, /DOCKER_SOCKET=\/var\/run\/docker\.sock/);
  assert.doesNotMatch(envExample, /\/Users\/andreril/);
});

test("web Dockerfile uses deterministic dependency install", async () => {
  const dockerfile = await readFile(path.join(repoRoot, "web/Dockerfile"), "utf-8");
  const packageJson = await readFile(path.join(repoRoot, "web/package.json"), "utf-8");

  assert.match(dockerfile, /npm ci --omit=dev/);
  assert.doesNotMatch(packageJson, /"latest"/);
});

test("Splunk apps use Learn Splunk as the author name", async () => {
  const appConfs = [
    "splunk/common/apps/lab_web_embedding/default/app.conf",
    "splunk/deployment-apps/TA_common_outputs/default/app.conf",
    "splunk/deployment-apps/TA_heavy_forwarder_parsing/default/app.conf",
    "splunk/deployment-apps/TA_heavy_forwarder_receiving/default/app.conf",
    "splunk/deployment-apps/TA_linux_file_inputs/default/app.conf",
    "splunk/deployment-apps/TA_network_inputs/default/app.conf",
    "splunk/deployment-apps/TA_outputs_to_heavy/default/app.conf",
    "splunk/deployment-apps/TA_scripted_inputs/default/app.conf",
    "splunk/deployment-server/apps/lab_web_proxy/default/app.conf",
    "splunk/heavy-forwarder/apps/lab_web_proxy/default/app.conf",
    "splunk/indexer/apps/lab_index/default/app.conf",
    "splunk/indexer/apps/lab_web_proxy/default/app.conf",
  ];

  for (const file of appConfs) {
    const content = await readFile(path.join(repoRoot, file), "utf-8");
    assert.match(content, /author\s*=\s*Learn Splunk/);
    assert.doesNotMatch(content, /Splunk Learn Forwarding/);
  }
});

test("Splunk web proxy apps define path prefixes for same-origin embedding", async () => {
  const expectations = [
    ["splunk/indexer/apps/lab_web_proxy/default/web.conf", /root_endpoint\s*=\s*\/splunk/],
    [
      "splunk/deployment-server/apps/lab_web_proxy/default/web.conf",
      /root_endpoint\s*=\s*\/deployment/,
    ],
    ["splunk/heavy-forwarder/apps/lab_web_proxy/default/web.conf", /root_endpoint\s*=\s*\/heavy/],
  ];

  for (const [file, pattern] of expectations) {
    const content = await readFile(path.join(repoRoot, file), "utf-8");
    assert.match(content, pattern);
  }
});

test("Splunk web proxy apps are mounted into their matching services", async () => {
  const compose = await readFile(path.join(repoRoot, "docker-compose.yml"), "utf-8");

  assert.match(compose, /splunk\/indexer\/apps\/lab_web_proxy:\/opt\/splunk\/etc\/apps\/lab_web_proxy/);
  assert.match(
    compose,
    /splunk\/deployment-server\/apps\/lab_web_proxy:\/opt\/splunk\/etc\/apps\/lab_web_proxy/,
  );
  assert.match(
    compose,
    /splunk\/heavy-forwarder\/apps\/lab_web_proxy:\/opt\/splunk\/etc\/apps\/lab_web_proxy/,
  );
});

test("Splunk Web instances define native global role banners", async () => {
  const expectations = [
    [
      "splunk/indexer/apps/lab_web_proxy/default/global-banner.conf",
      /global_banner\.message\s*=\s*LAB ROLE: INDEXER \/ SEARCH HEAD/,
      /global_banner\.background_color\s*=\s*blue/,
    ],
    [
      "splunk/deployment-server/apps/lab_web_proxy/default/global-banner.conf",
      /global_banner\.message\s*=\s*LAB ROLE: DEPLOYMENT SERVER/,
      /global_banner\.background_color\s*=\s*orange/,
    ],
    [
      "splunk/heavy-forwarder/apps/lab_web_proxy/default/global-banner.conf",
      /global_banner\.message\s*=\s*LAB ROLE: HEAVY FORWARDER/,
      /global_banner\.background_color\s*=\s*yellow/,
    ],
  ];

  for (const [file, messagePattern, colorPattern] of expectations) {
    const content = await readFile(path.join(repoRoot, file), "utf-8");
    assert.match(content, /\[BANNER_MESSAGE_SINGLETON\]/);
    assert.match(content, /global_banner\.visible\s*=\s*true/);
    assert.match(content, messagePattern);
    assert.match(content, colorPattern);
  }
});

test("deployment server defines direct and via-heavy universal forwarder paths", async () => {
  const serverclass = await readFile(
    path.join(repoRoot, "splunk/deployment-server/serverclass.conf"),
    "utf-8",
  );
  const outputsToHeavy = await readFile(
    path.join(repoRoot, "splunk/deployment-apps/TA_outputs_to_heavy/default/outputs.conf"),
    "utf-8",
  );
  const heavyReceiving = await readFile(
    path.join(repoRoot, "splunk/deployment-apps/TA_heavy_forwarder_receiving/default/inputs.conf"),
    "utf-8",
  );
  const networkInputs = await readFile(
    path.join(repoRoot, "splunk/deployment-apps/TA_network_inputs/default/inputs.conf"),
    "utf-8",
  );

  assert.match(serverclass, /\[serverClass:direct_universal_forwarders\]/);
  assert.match(serverclass, /whitelist\.0\s*=\s*universal-forwarder/);
  assert.match(serverclass, /\[serverClass:via_heavy_universal_forwarders\]/);
  assert.match(serverclass, /whitelist\.0\s*=\s*universal-forwarder-via-heavy/);
  assert.match(serverclass, /\[serverClass:heavy_forwarders:app:TA_heavy_forwarder_receiving\]/);
  assert.match(serverclass, /\[serverClass:heavy_forwarders:app:TA_scripted_inputs\]/);
  assert.match(outputsToHeavy, /server\s*=\s*heavy-forwarder:9997/);
  assert.match(heavyReceiving, /\[splunktcp:\/\/9997\]/);
  assert.match(networkInputs, /\[tcp:\/\/1514\]/);
  assert.match(networkInputs, /\[udp:\/\/1515\]/);
});

test("file input app defines structured JSON and XML monitors", async () => {
  const inputs = await readFile(
    path.join(repoRoot, "splunk/deployment-apps/TA_linux_file_inputs/default/inputs.conf"),
    "utf-8",
  );
  const indexerProps = await readFile(
    path.join(repoRoot, "splunk/indexer/apps/lab_index/default/props.conf"),
    "utf-8",
  );
  const heavyProps = await readFile(
    path.join(repoRoot, "splunk/deployment-apps/TA_heavy_forwarder_parsing/default/props.conf"),
    "utf-8",
  );

  assert.match(inputs, /\[monitor:\/\/\/var\/log\/lab\/events\.json\]/);
  assert.match(inputs, /sourcetype\s*=\s*lab:json/);
  assert.match(inputs, /\[monitor:\/\/\/var\/log\/lab\/otel\.json\]/);
  assert.match(inputs, /sourcetype\s*=\s*lab:otel/);
  assert.match(inputs, /\[monitor:\/\/\/var\/log\/lab\/events\.xml\]/);
  assert.match(inputs, /sourcetype\s*=\s*lab:xml/);
  for (const props of [indexerProps, heavyProps]) {
    assert.match(props, /\[lab:json\]/);
    assert.match(props, /INDEXED_EXTRACTIONS\s*=\s*json/);
    assert.match(props, /\[lab:otel\]/);
    assert.match(props, /\[lab:xml\]/);
    assert.match(props, /TIME_PREFIX\s*=\s*ts="/);
    assert.match(props, /\[lab:hec\]/);
  }
});

test("indexer defines dedicated source indexes and removes shared lab index", async () => {
  const indexes = await readFile(
    path.join(repoRoot, "splunk/indexer/apps/lab_index/default/indexes.conf"),
    "utf-8",
  );

  for (const indexName of [
    "lab_file",
    "lab_tcp",
    "lab_udp",
    "lab_json",
    "lab_otel",
    "lab_xml",
    "lab_hec",
    "lab_scripted",
    "lab_masked",
  ]) {
    assert.match(indexes, new RegExp(`\\[${indexName}\\]`));
    assert.match(indexes, new RegExp(`\\$SPLUNK_DB/${indexName}/db`));
  }
  assert.doesNotMatch(indexes, /^\[lab\]/m);
});

test("indexer mounts and defines Buttercup Games sample app", async () => {
  const compose = await readFile(path.join(repoRoot, "docker-compose.yml"), "utf-8");
  const appConf = await readFile(path.join(repoRoot, "splunk/indexer/apps/buttercup_app/app.conf"), "utf-8");
  const indexes = await readFile(
    path.join(repoRoot, "splunk/indexer/apps/buttercup_app/default/indexes.conf"),
    "utf-8",
  );
  const inputs = await readFile(
    path.join(repoRoot, "splunk/indexer/apps/buttercup_app/default/inputs.conf"),
    "utf-8",
  );
  const props = await readFile(
    path.join(repoRoot, "splunk/indexer/apps/buttercup_app/default/props.conf"),
    "utf-8",
  );
  const access = await readFile(
    path.join(repoRoot, "splunk/indexer/apps/buttercup_app/data/buttercup_access.txt"),
    "utf-8",
  );
  const sales = await readFile(
    path.join(repoRoot, "splunk/indexer/apps/buttercup_app/data/vendor_sales.csv"),
    "utf-8",
  );
  const products = await readFile(
    path.join(repoRoot, "splunk/indexer/apps/buttercup_app/data/products.csv"),
    "utf-8",
  );

  assert.match(compose, /buttercup_app:\/opt\/splunk\/etc\/apps\/buttercup_app/);
  assert.match(appConf, /label=Buttercup Games/);
  assert.match(indexes, /\[buttercup\]/);
  assert.match(inputs, /buttercup_access\.txt[\s\S]*index\s*=\s*buttercup[\s\S]*sourcetype\s*=\s*buttercup_web/);
  assert.match(inputs, /vendor_sales\.csv[\s\S]*sourcetype\s*=\s*buttercup_sales/);
  assert.match(inputs, /products\.csv[\s\S]*sourcetype\s*=\s*buttercup_products/);
  assert.match(props, /\[buttercup_sales\][\s\S]*INDEXED_EXTRACTIONS\s*=\s*csv/);
  assert.match(props, /\[buttercup_products\][\s\S]*INDEXED_EXTRACTIONS\s*=\s*csv/);
  assert.match(props, /\[buttercup_web\][\s\S]*EXTRACT-apache/);
  assert.match(access, /GET \/productcatalog/);
  assert.match(sales, /units_sold,revenue/);
  assert.match(products, /product_id,product_name,price,category/);
});

test("data source inputs route to dedicated indexes", async () => {
  const fileInputs = await readFile(
    path.join(repoRoot, "splunk/deployment-apps/TA_linux_file_inputs/default/inputs.conf"),
    "utf-8",
  );
  const networkInputs = await readFile(
    path.join(repoRoot, "splunk/deployment-apps/TA_network_inputs/default/inputs.conf"),
    "utf-8",
  );
  const scriptedInputs = await readFile(
    path.join(repoRoot, "splunk/deployment-apps/TA_scripted_inputs/default/inputs.conf"),
    "utf-8",
  );

  assert.match(fileInputs, /\[monitor:\/\/\/var\/log\/lab\/app\.log\][\s\S]*index\s*=\s*lab_file/);
  assert.match(fileInputs, /\[monitor:\/\/\/var\/log\/lab\/events\.json\][\s\S]*index\s*=\s*lab_json/);
  assert.match(fileInputs, /\[monitor:\/\/\/var\/log\/lab\/otel\.json\][\s\S]*index\s*=\s*lab_otel/);
  assert.match(fileInputs, /\[monitor:\/\/\/var\/log\/lab\/otel\.json\][\s\S]*sourcetype\s*=\s*lab:otel/);
  assert.match(fileInputs, /\[monitor:\/\/\/var\/log\/lab\/events\.xml\][\s\S]*index\s*=\s*lab_xml/);
  assert.match(fileInputs, /\[monitor:\/\/\/var\/log\/lab\/pii\.log\][\s\S]*index\s*=\s*lab_masked/);
  assert.match(fileInputs, /\[monitor:\/\/\/var\/log\/lab\/pii\.log\][\s\S]*sourcetype\s*=\s*lab:masked/);
  assert.match(networkInputs, /\[tcp:\/\/1514\][\s\S]*index\s*=\s*lab_tcp/);
  assert.match(networkInputs, /\[udp:\/\/1515\][\s\S]*index\s*=\s*lab_udp/);
  assert.match(scriptedInputs, /python_scripted_input\.py\][\s\S]*index\s*=\s*lab_scripted/);
  assert.match(scriptedInputs, /bash_scripted_input\.sh\][\s\S]*index\s*=\s*lab_scripted/);
});

test("heavy forwarder masks PII with props and transforms", async () => {
  const props = await readFile(
    path.join(repoRoot, "splunk/deployment-apps/TA_heavy_forwarder_parsing/default/props.conf"),
    "utf-8",
  );
  const transforms = await readFile(
    path.join(repoRoot, "splunk/deployment-apps/TA_heavy_forwarder_parsing/default/transforms.conf"),
    "utf-8",
  );
  const generator = await readFile(path.join(repoRoot, "scripts/generate_pii_events.py"), "utf-8");

  assert.match(props, /\[lab:masked\]/);
  assert.match(props, /TRANSFORMS-mask_pii\s*=\s*mask_email,\s*mask_credit_card/);
  assert.match(transforms, /\[mask_email\]/);
  assert.match(transforms, /DEST_KEY\s*=\s*_raw/);
  assert.match(transforms, /\*\*\*@masked\.local/);
  assert.match(transforms, /\[mask_credit_card\]/);
  assert.match(transforms, /\*\*\*\*\*\*\*\*\*\*\*\*/);
  assert.match(generator, /email=/);
  assert.match(generator, /card=/);
});

test("scripted input app defines Python and bash examples", async () => {
  const inputs = await readFile(
    path.join(repoRoot, "splunk/deployment-apps/TA_scripted_inputs/default/inputs.conf"),
    "utf-8",
  );
  const pythonScript = await readFile(
    path.join(repoRoot, "splunk/deployment-apps/TA_scripted_inputs/bin/python_scripted_input.py"),
    "utf-8",
  );
  const bashScript = await readFile(
    path.join(repoRoot, "splunk/deployment-apps/TA_scripted_inputs/bin/bash_scripted_input.sh"),
    "utf-8",
  );

  assert.match(inputs, /\[script:\/\/\$SPLUNK_HOME\/etc\/apps\/TA_scripted_inputs\/bin\/python_scripted_input\.py\]/);
  assert.match(inputs, /sourcetype\s*=\s*lab:scripted:python/);
  assert.match(inputs, /\[script:\/\/\$SPLUNK_HOME\/etc\/apps\/TA_scripted_inputs\/bin\/bash_scripted_input\.sh\]/);
  assert.match(inputs, /sourcetype\s*=\s*lab:scripted:bash/);
  assert.match(pythonScript, /scripted_input=python/);
  assert.match(bashScript, /scripted_input=bash/);
});

test("HEC generator sets explicit Splunk metadata", async () => {
  const generator = await readFile(path.join(repoRoot, "scripts/generate_hec_events.py"), "utf-8");

  assert.match(generator, /INDEX = "lab_hec"/);
  assert.match(generator, /"index": INDEX/);
  assert.match(generator, /"source": "http-event-collector-source"/);
  assert.match(generator, /"sourcetype": SOURCETYPE/);
});

test("OpenTelemetry generator sets explicit Splunk metadata", async () => {
  const generator = await readFile(path.join(repoRoot, "scripts/generate_otel_events.py"), "utf-8");

  assert.match(generator, /trace_id/);
  assert.match(generator, /span_id/);
  assert.match(generator, /service\.name/);
  assert.match(generator, /telemetry_type/);
});

test("data source inspector lists destination metadata", async () => {
  const inspector = await readFile(path.join(repoRoot, "scripts/show_data_source.py"), "utf-8");

  for (const expected of [
    '"index": "lab_file"',
    '"source": "/var/log/lab/app.log"',
    '"sourcetype": "lab:app"',
    '"index": "lab_tcp"',
    '"source": "tcp:1514"',
    '"sourcetype": "lab:tcp"',
    '"index": "lab_udp"',
    '"source": "udp:1515"',
    '"sourcetype": "lab:udp"',
    '"index": "lab_json"',
    '"source": "/var/log/lab/events.json"',
    '"sourcetype": "lab:json"',
    '"index": "lab_otel"',
    '"source": "/var/log/lab/otel.json"',
    '"sourcetype": "lab:otel"',
    '"index": "lab_xml"',
    '"source": "/var/log/lab/events.xml"',
    '"sourcetype": "lab:xml"',
    '"index": "lab_masked"',
    '"source": "/var/log/lab/pii.log"',
    '"sourcetype": "lab:masked"',
    '"index": "buttercup"',
    '"source": "buttercup_app/data/*"',
    '"sourcetype": "buttercup_web, buttercup_sales, buttercup_products"',
    '"files": [',
    'BUTTERCUP_APP',
    'FILE_INPUTS',
    'DIRECT_OUTPUTS',
    'VIA_HEAVY_OUTPUTS',
    'HF_RECEIVING_INPUTS',
    'HF_PROPS',
    'HF_TRANSFORMS',
    'scripts/generate_pii_events.py',
    'scripts/generate_hec_events.py',
    'scripts/generate_structured_file_events.py',
    'scripts/generate_otel_events.py',
    'scripts/generate_network_events.py',
    'scripts/generate_logs.py',
    'Relevant lab files',
    'EFFECTIVE RUNTIME CONFIG',
    'RUNTIME HEC INPUT',
    'print_metadata("lab_hec", "http-event-collector-source", "lab:hec")',
    'print_metadata("lab_scripted", "TA_scripted_inputs/bin/*", "lab:scripted:python, lab:scripted:bash")',
    'show_buttercup()',
  ]) {
    assert.ok(inspector.includes(expected), expected);
  }
});

test("compose defines second UF and data source examples", async () => {
  const compose = await readFile(path.join(repoRoot, "docker-compose.yml"), "utf-8");

  assert.match(compose, /universal-forwarder-via-heavy:/);
  assert.match(compose, /sample-log-source-via-heavy:/);
  assert.match(compose, /tcp-udp-source-direct:/);
  assert.match(compose, /tcp-udp-source-via-heavy:/);
  assert.match(compose, /structured-json-source:/);
  assert.match(compose, /open-telemetry-source:/);
  assert.match(compose, /generate_otel_events\.py/);
  assert.match(compose, /structured-xml-source:/);
  assert.match(compose, /masked-pii-source:/);
  assert.match(compose, /generate_pii_events\.py/);
  assert.match(compose, /http-event-collector-source:/);
  assert.match(compose, /generate_hec_events\.py/);
  assert.match(compose, /TA_scripted_inputs:\/opt\/splunk\/etc\/apps\/TA_scripted_inputs/);
  assert.match(compose, /buttercup_app:\/opt\/splunk\/etc\/apps\/buttercup_app/);
  assert.match(compose, /universal-forwarder-via-heavy",\s*"1514",\s*"1515"/);
  assert.match(compose, /TA_outputs_to_heavy:\/opt\/splunkforwarder\/etc\/apps\/TA_outputs_to_heavy/);
  assert.match(
    compose,
    /TA_heavy_forwarder_receiving:\/opt\/splunk\/etc\/apps\/TA_heavy_forwarder_receiving/,
  );
});
