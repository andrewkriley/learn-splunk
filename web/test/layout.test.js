import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("cockpit CSS prioritizes a two-pane layout with lessons below", async () => {
  const css = await readFile(path.resolve(__dirname, "../public/styles.css"), "utf-8");

  assert.match(
    css,
    /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    css,
    /grid-template-rows:\s*calc\(100vh - 88px\) minmax\(170px, auto\) minmax\(420px, auto\)/,
  );
  assert.match(css, /min-height:\s*calc\(100vh - 56px\)/);
  assert.match(css, /overflow-y:\s*auto/);
  assert.match(css, /min-width:\s*1320px/);
  assert.match(css, /\.workspace\s*\{[\s\S]*grid-column:\s*2/);
  assert.match(css, /\.workspace\s*\{[\s\S]*grid-row:\s*1/);
  assert.match(css, /\.tips-panel\s*\{[\s\S]*grid-column:\s*1 \/ -1/);
  assert.match(css, /\.tips-panel\s*\{[\s\S]*grid-row:\s*2/);
  assert.match(css, /\.instructions\s*\{[\s\S]*grid-column:\s*1 \/ -1/);
  assert.match(css, /\.instructions\s*\{[\s\S]*grid-row:\s*3/);
});

test("cockpit CSS includes visual architecture diagram styles", async () => {
  const css = await readFile(path.resolve(__dirname, "../public/styles.css"), "utf-8");

  assert.match(css, /\.architecture-page/);
  assert.match(css, /\.architecture-pane/);
  assert.match(css, /\.architecture-map/);
  assert.match(css, /\.cockpit-wrapper/);
  assert.match(css, /\.tips-panel/);
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

  assert.match(css, /\.architecture-pane\s*\{[\s\S]*grid-column:\s*1/);
  assert.match(css, /\.architecture-pane\s*\{[\s\S]*grid-row:\s*1/);
  assert.match(css, /\.architecture-pane\s*\{[\s\S]*display:\s*flex/);
  assert.doesNotMatch(css, /\.architecture-pane\s*\{[\s\S]*resize:\s*horizontal/);
  assert.doesNotMatch(css, /\.architecture-pane\s*\{[\s\S]*width:\s*25vw/);
  assert.match(css, /\.architecture-page\s*\{[\s\S]*display:\s*grid/);
  assert.match(css, /\.architecture-page\s*\{[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.architecture-page\s*\{[\s\S]*width:\s*100%/);
  assert.match(
    css,
    /\.architecture-diagram\s*\{[\s\S]*grid-template-columns:\s*fit-content\(150px\) minmax\(0, 1fr\)/,
  );
  assert.match(css, /\.architecture-diagram\s*\{[\s\S]*flex:\s*1 1 auto/);
  assert.match(css, /\.architecture-diagram\s*\{[\s\S]*min-height:\s*0/);
  assert.match(
    css,
    /\.destination-tiers\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(110px, 0\.75fr\)/,
  );
  assert.doesNotMatch(css, /\.management-column\s*\{[\s\S]*align-self:\s*start/);
  assert.match(
    css,
    /\.source-examples\s*\{[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/,
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
  assert.match(css, /\.architecture-map\s*\{[\s\S]*overflow:\s*auto/);
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
