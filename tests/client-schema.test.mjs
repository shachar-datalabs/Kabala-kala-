import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root, resolve: { alias: { "@": root } }, server: { middlewareMode: true } });
after(async () => vite.close());
const schemaModule = await vite.ssrLoadModule("/lib/client-schema.ts");
const { clientInputSchema } = schemaModule;

test("creates a client with name only", () => {
  assert.equal(clientInputSchema.safeParse({ name: "יעל כהן" }).success, true);
});

test("rejects a client without a name", () => {
  assert.equal(clientInputSchema.safeParse({ name: "" }).success, false);
});

test("validates an optional email", () => {
  assert.equal(clientInputSchema.safeParse({ name: "לקוח", email: "not-an-email" }).success, false);
});
