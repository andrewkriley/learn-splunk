import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("cockpit CSS loads guide sections into a single main viewport", async () => {
  const css = await readFile(path.resolve(__dirname, "../public/styles.css"), "utf-8");

  assert.match(
    css,
    /grid-template-columns:\s*240px minmax\(0, 1fr\) minmax\(460px, 0\.9fr\)/,
  );
  assert.match(css, /height:\s*calc\(100vh - 56px\)/);
  assert.match(css, /overflow:\s*hidden/);
  assert.match(css, /body\s*\{[\s\S]*overflow:\s*hidden/);
  assert.match(css, /\.guide-nav\s*\{[\s\S]*grid-column:\s*1/);
  assert.match(css, /\.guide-section\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /\.guide-section\.active\s*\{[\s\S]*display:\s*block/);
  assert.match(css, /\.architecture-pane\.active\s*\{[\s\S]*display:\s*flex/);
  assert.match(css, /\.instructions\.active\s*\{[\s\S]*display:\s*grid/);
  assert.match(css, /\.workspace\s*\{[\s\S]*grid-column:\s*3/);
  assert.match(css, /\.workspace\s*\{[\s\S]*display:\s*block/);
  assert.match(css, /\.tips-panel,\s*[\s\S]*\.instructions\s*\{[\s\S]*grid-column:\s*2/);
  assert.match(css, /\.tips-panel,\s*[\s\S]*\.instructions\s*\{[\s\S]*grid-row:\s*1/);
});

test("cockpit CSS supports Splunk-lab colors and theme modes", async () => {
  const css = await readFile(path.resolve(__dirname, "../public/styles.css"), "utf-8");

  assert.match(css, /--splunk-navy:\s*#0c1724/);
  assert.match(css, /--splunk-green:\s*#65a637/);
  assert.match(css, /--splunk-coral:\s*#f16221/);
  assert.match(css, /--splunk-pink:\s*#eb008b/);
  assert.match(css, /--splunk-aqua:\s*#00a9e0/);
  assert.match(css, /--topology-search-bg:/);
  assert.match(css, /--topology-collection-bg:/);
  assert.match(css, /--topology-node-bg:/);
  assert.match(css, /--topology-pill-bg:/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.match(css, /:root\[data-theme="light"\]/);
  assert.match(css, /prefers-color-scheme:\s*dark/);
  assert.match(css, /:root\[data-theme="system"\][\s\S]*--topology-search-bg:/);
  assert.match(css, /\.theme-picker/);
});

test("cockpit CSS includes visual architecture diagram styles", async () => {
  const css = await readFile(path.resolve(__dirname, "../public/styles.css"), "utf-8");

  assert.match(css, /\.architecture-page/);
  assert.match(css, /\.architecture-pane/);
  assert.match(css, /\.guide-nav/);
  assert.match(css, /\.overview-panel/);
  assert.match(css, /\.data-source-panel/);
  assert.match(css, /\.journey-card/);
  assert.match(css, /\.status-panel/);
  assert.match(css, /\.status-detail-card/);
  assert.match(css, /\.docs-panel/);
  assert.match(css, /\.parsing-panel/);
  assert.match(css, /\.setup-tabs/);
  assert.match(css, /\.architecture-map/);
  assert.doesNotMatch(css, /\.cockpit-wrapper/);
  assert.match(css, /\.tips-panel/);
  assert.match(css, /\.mcp-panel/);
  assert.match(css, /\.mcp-card-list/);
  assert.match(css, /\.mcp-card/);
  assert.match(css, /\.mcp-explorer/);
  assert.match(css, /\.mcp-explorer-grid/);
  assert.match(css, /\.mcp-tool-list/);
  assert.match(css, /\.mcp-result/);
  assert.match(css, /\.lab-status-strip/);
  assert.match(css, /\.status-badge/);
  assert.match(css, /\.guide-code-block/);
  assert.match(css, /\.copy-btn/);
  assert.match(css, /\.tip-list/);
  assert.match(css, /\.tip-card/);
  assert.match(css, /\.architecture-diagram/);
  assert.match(css, /\.destination-tiers/);
  assert.match(css, /\.search-index-tier/);
  assert.match(css, /\.nested-tier/);
  assert.match(css, /\.splunk-enterprise-tier/);
  assert.match(css, /\.splunk-cloud-tier/);
  assert.match(css, /\.function-pair/);
  assert.match(css, /\.cloud-destination/);
  assert.match(css, /\.data-source-tier/);
  assert.match(css, /\.source-examples/);
  assert.match(css, /\.data-source-card/);
  assert.match(css, /\.topology-command-card/);
  assert.match(css, /\.source-meta/);
  assert.match(css, /\.config-list/);
  assert.match(css, /\.collection-tier/);
  assert.match(css, /\.collection-flow/);
  assert.match(css, /\.path-card/);
  assert.match(css, /\.path-arrow/);
  assert.match(css, /\.management-column/);
  assert.match(css, /\.platform-stack/);
  assert.match(css, /\.node-role/);
  assert.doesNotMatch(css, /\.reference-grid/);
});

test("cockpit CSS shows architecture beside workspace with side-by-side management", async () => {
  const css = await readFile(path.resolve(__dirname, "../public/styles.css"), "utf-8");

  assert.match(css, /\.architecture-pane\s*\{[\s\S]*grid-column:\s*2/);
  assert.match(css, /\.architecture-pane\s*\{[\s\S]*grid-row:\s*1/);
  assert.match(css, /\.architecture-pane\s*\{[\s\S]*display:\s*flex/);
  assert.doesNotMatch(css, /\.architecture-pane\s*\{[\s\S]*resize:\s*horizontal/);
  assert.doesNotMatch(css, /\.architecture-pane\s*\{[\s\S]*width:\s*25vw/);
  assert.match(css, /\.architecture-page\s*\{[\s\S]*display:\s*grid/);
  assert.match(css, /\.architecture-page\s*\{[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.architecture-page\s*\{[\s\S]*width:\s*100%/);
  assert.match(
    css,
    /\.architecture-diagram\s*\{[\s\S]*grid-template-columns:\s*fit-content\(128px\) minmax\(0, 1fr\)/,
  );
  assert.match(css, /\.architecture-diagram\s*\{[\s\S]*height:\s*100%/);
  assert.match(css, /\.architecture-diagram\s*\{[\s\S]*max-height:\s*100%/);
  assert.match(css, /\.architecture-diagram\s*\{[\s\S]*flex:\s*1 1 auto/);
  assert.match(css, /\.architecture-diagram\s*\{[\s\S]*min-height:\s*0/);
  assert.match(
    css,
    /\.destination-tiers\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(100px, 0\.65fr\)/,
  );
  assert.doesNotMatch(css, /\.management-column\s*\{[\s\S]*align-self:\s*start/);
  assert.match(
    css,
    /\.source-examples\s*\{[\s\S]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/,
  );
  assert.match(css, /\.source-examples\s*\{[\s\S]*grid-auto-rows:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.source-examples\s*\{[\s\S]*align-items:\s*stretch/);
  assert.match(css, /\.data-source-card\s*\{[\s\S]*align-self:\s*stretch/);
  assert.match(css, /\.data-source-card\s*\{[\s\S]*height:\s*100%/);
  assert.match(
    css,
    /\.collection-flow\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
  );
  assert.match(css, /\.architecture-page\s*\{[\s\S]*overflow:\s*hidden/);
  assert.match(css, /\.architecture-map\s*\{[\s\S]*display:\s*flex/);
  assert.match(css, /\.architecture-map\s*\{[\s\S]*height:\s*100%/);
  assert.match(css, /\.architecture-map\s*\{[\s\S]*overflow:\s*hidden/);
  assert.match(css, /\.architecture-pane\.active\s*\{[\s\S]*overflow:\s*hidden/);
  assert.match(css, /\.search-index-tier\s*\{[\s\S]*background:\s*var\(--topology-search-bg\)/);
  assert.match(css, /\.collection-tier\s*\{[\s\S]*background:\s*var\(--topology-collection-bg\)/);
  assert.match(css, /\.node\s*\{[\s\S]*background:\s*var\(--topology-node-bg\)/);
  assert.match(css, /\.vertical-flow,[\s\S]*\.management-link\s*\{[\s\S]*background:\s*var\(--topology-pill-bg\)/);
  assert.match(css, /\.path-arrow\s*\{[\s\S]*background:\s*var\(--topology-pill-bg\)/);
  assert.match(css, /\.tips-panel\s*\{[\s\S]*overflow:\s*auto/);
  assert.match(css, /\.tip-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
});

test("cockpit CSS places lesson modules in a horizontal heading row", async () => {
  const css = await readFile(path.resolve(__dirname, "../public/styles.css"), "utf-8");

  assert.match(css, /\.lesson-heading/);
  assert.match(css, /\.instructions\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(0, 1fr\)/);
  assert.match(css, /\.module-row\s*\{[\s\S]*display:\s*flex/);
  assert.match(css, /\.module-row\s*\{[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /\.lesson-button\s*\{[\s\S]*white-space:\s*nowrap/);
  assert.match(css, /#lesson-content\s*\{[\s\S]*overflow:\s*auto/);
});

test("cockpit CSS places Lab CLI output above evenly distributed buttons", async () => {
  const css = await readFile(path.resolve(__dirname, "../public/styles.css"), "utf-8");

  assert.match(css, /\.terminal\s*\{[\s\S]*overflow:\s*hidden/);
  assert.match(css, /\.command-panel\s*\{[\s\S]*display:\s*grid/);
  assert.match(
    css,
    /\.command-panel\s*\{[\s\S]*grid-template-rows:\s*minmax\(0, 3fr\) auto auto minmax\(0, 1fr\)/,
  );
  assert.match(css, /\.command-list\s*\{[\s\S]*display:\s*grid/);
  assert.match(
    css,
    /\.command-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit, minmax\(150px, 1fr\)\)/,
  );
  assert.match(css, /\.command-list\s*\{[\s\S]*grid-auto-rows:\s*minmax\(36px, 1fr\)/);
  assert.match(css, /\.command-list button\s*\{[\s\S]*justify-content:\s*center/);
  assert.match(css, /\.command-list button\s*\{[\s\S]*min-height:\s*36px/);
  assert.match(css, /#command-output\s*\{[\s\S]*min-height:\s*0/);
  assert.match(css, /#command-output\s*\{[\s\S]*overflow:\s*auto/);
});
