import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lessonsDir = path.resolve(__dirname, "../../lessons");

test("every lesson includes reusable Splunk login details", async () => {
  const lessonFiles = (await readdir(lessonsDir)).filter((file) => file.endsWith(".md"));

  assert.ok(lessonFiles.length > 0);

  for (const file of lessonFiles) {
    const content = await readFile(path.join(lessonsDir, file), "utf-8");

    assert.match(content, /## Login Details/, `${file} should include login details`);
    assert.match(content, /username:\s*`admin`/i, `${file} should mention the admin username`);
    assert.match(content, /`{{SPLUNK_PASSWORD}}`/, `${file} should use the runtime password token`);
    assert.doesNotMatch(
      content,
      /LocalLabPassword123!/,
      `${file} should not hardcode the local lab password`,
    );
  }
});
