import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => vite.close());

const configModule = await vite.ssrLoadModule("/services/easycount/config.ts");
const { assertEasycountIssuingEnabled, evaluateEasycountConfiguration } = configModule;

test("SAFE MODE stays active unless explicitly enabled", () => {
  const status = evaluateEasycountConfiguration({
    EASYCOUNT_ENABLED: "false",
    EZCOUNT_BASE_URL: "https://demo.ezcount.co.il",
    EZCOUNT_API_KEY: "test-placeholder",
    EZCOUNT_DEVELOPER_EMAIL: "developer@example.test",
  });

  assert.equal(status.enabled, false);
  assert.equal(status.configured, false);
});

test("SAFE MODE stops execution before an external request", () => {
  let externalRequests = 0;
  assert.throws(() => {
    assertEasycountIssuingEnabled({
      EASYCOUNT_ENABLED: "false",
      EZCOUNT_BASE_URL: "https://demo.ezcount.co.il",
    });
    externalRequests += 1;
  });
  assert.equal(externalRequests, 0);
});

test("production endpoint remains blocked without a separate explicit flag", () => {
  const status = evaluateEasycountConfiguration({
    EASYCOUNT_ENABLED: "true",
    EZCOUNT_BASE_URL: "https://api.ezcount.co.il",
    EZCOUNT_API_KEY: "test-placeholder",
    EZCOUNT_DEVELOPER_EMAIL: "developer@example.test",
  });

  assert.equal(status.configured, false);
  assert.equal(status.environment, "blocked");
});

test("production requires both explicit flags and both credentials", () => {
  const status = evaluateEasycountConfiguration({
    EASYCOUNT_ENABLED: "true",
    EASYCOUNT_ALLOW_PRODUCTION: "true",
    EZCOUNT_BASE_URL: "https://api.ezcount.co.il",
    EZCOUNT_API_KEY: "test-placeholder",
    EZCOUNT_DEVELOPER_EMAIL: "developer@example.test",
  });

  assert.equal(status.configured, true);
  assert.equal(status.environment, "production");
});

test("demo requires the explicit flag and both credentials", () => {
  const status = evaluateEasycountConfiguration({
    EASYCOUNT_ENABLED: "true",
    EZCOUNT_BASE_URL: "https://demo.ezcount.co.il",
    EZCOUNT_API_KEY: "test-placeholder",
    EZCOUNT_DEVELOPER_EMAIL: "developer@example.test",
  });

  assert.equal(status.configured, true);
  assert.equal(status.environment, "demo");
});
