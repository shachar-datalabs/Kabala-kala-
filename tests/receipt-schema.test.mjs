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

const { receiptInputSchema } = await vite.ssrLoadModule(
  "/lib/receipt-schema.ts",
);

function receipt(overrides = {}) {
  return {
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    documentType: "receipt",
    customerName: "לקוח בדיקה",
    customerEmail: "demo@example.test",
    amount: 100,
    documentDate: "2026-08-31",
    paymentType: 4,
    description: "שירות",
    sendEmail: true,
    ...overrides,
  };
}

test("accepts receipt and proforma but rejects tax invoices", () => {
  assert.equal(receiptInputSchema.safeParse(receipt()).success, true);
  assert.equal(
    receiptInputSchema.safeParse(
      receipt({ documentType: "proforma", paymentType: 1 }),
    ).success,
    true,
  );
  assert.equal(
    receiptInputSchema.safeParse(
      receipt({ documentType: "tax-invoice" }),
    ).success,
    false,
  );
});

test("requires only card type and last four digits", () => {
  assert.equal(
    receiptInputSchema.safeParse(
      receipt({ paymentType: 3, cardType: "visa", cardLastFour: "1234" }),
    ).success,
    true,
  );
  assert.equal(
    receiptInputSchema.safeParse(
      receipt({ paymentType: 3, cardType: "visa", cardLastFour: "4111111111111111" }),
    ).success,
    false,
  );
});

test("requires cheque identifiers only for cheque receipts", () => {
  assert.equal(
    receiptInputSchema.safeParse(receipt({ paymentType: 2 })).success,
    false,
  );
  assert.equal(
    receiptInputSchema.safeParse(
      receipt({ paymentType: 2, checkBankName: "בנק", checkNumber: "42" }),
    ).success,
    true,
  );
});
