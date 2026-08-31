import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("emits a deployable Cloudflare worker entry", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  await access(workerUrl);
  const workerSource = await readFile(workerUrl, "utf8");

  assert.ok(workerSource.length > 0);
  assert.match(workerSource, /fetch/);
});
