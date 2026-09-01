import { env } from "cloudflare:workers";
import { z } from "zod";
import type { ReceiptInput } from "@/lib/receipt-schema";
import {
  EASYCOUNT_DEMO_BASE_URL,
  assertEasycountIssuingEnabled,
  evaluateEasycountConfiguration,
  type EasycountRuntimeConfig,
} from "@/services/easycount/config";

const ezcountResponseSchema = z
  .object({
    success: z.boolean(),
    errMsg: z.string().optional(),
    errNum: z.union([z.string(), z.number()]).optional(),
    pdf_link: z.string().url().optional(),
    pdf_link_copy: z.string().url().optional(),
    doc_number: z.union([z.string(), z.number()]).optional(),
    doc_uuid: z.string().min(1).optional(),
  })
  .passthrough();

export type IssuedReceipt = {
  docNumber: string;
  docUuid: string;
  pdfLink: string;
};

export class EzcountUncertainError extends Error {}

function runtimeEnv(): EasycountRuntimeConfig {
  return env as unknown as EasycountRuntimeConfig;
}

export function getEzcountStatus() {
  return evaluateEasycountConfiguration(runtimeEnv());
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return [day, month, year].join("/");
}

function cardDetails(cardType: string) {
  const cards: Record<string, { type: number; name: string }> = {
    isracard: { type: 1, name: "ישראכרט" },
    visa: { type: 2, name: "Visa" },
    diners: { type: 3, name: "Diners" },
    amex: { type: 4, name: "American Express" },
    max: { type: 6, name: "MAX" },
    mastercard: { type: 99, name: "Mastercard" },
    other: { type: 0, name: "אחר" },
  };
  return cards[cardType] ?? cards.other;
}

function buildPayment(input: ReceiptInput) {
  const base = {
    payment_type: input.paymentType,
    payment_sum: input.amount,
    date: formatDate(input.documentDate),
    comment: input.paymentReference || undefined,
    currency: "ILS",
  };

  if (input.paymentType === 91) {
    return {
      ...base,
      wt_vendor: input.webVendor,
      wt_transaction_id: input.paymentReference || undefined,
    };
  }
  if (input.paymentType === 2) {
    return {
      ...base,
      checks_bank_name: input.checkBankName,
      checks_number: input.checkNumber,
      checks_bank_branch: input.checkBranch || undefined,
      checks_bank_account: input.checkAccount || undefined,
    };
  }
  if (input.paymentType === 3) {
    const card = cardDetails(input.cardType);
    return {
      ...base,
      cc_type: card.type,
      cc_type_name: card.name,
      cc_number: input.cardLastFour,
      cc_deal_type: 1,
      cc_num_of_payments: 1,
      cc_payment_num: 1,
    };
  }
  if (input.paymentType === 9) {
    return {
      ...base,
      other_payment_type_name: input.otherPaymentName,
    };
  }
  return base;
}

export async function issueReceipt(input: ReceiptInput): Promise<IssuedReceipt> {
  const runtime = runtimeEnv();
  assertEasycountIssuingEnabled(runtime);
  const apiKey = runtime.EZCOUNT_API_KEY;
  const developerEmail = runtime.EZCOUNT_DEVELOPER_EMAIL;

  if (!apiKey || !developerEmail) {
    throw new Error("EasyCount עדיין לא מחובר למערכת");
  }

  const baseUrl = runtime.EZCOUNT_BASE_URL;
  if (baseUrl !== EASYCOUNT_DEMO_BASE_URL) {
    throw new Error("הפקת מסמכים מותרת כרגע בסביבת EasyCount Demo בלבד");
  }

  let response: Response;
  try {
    response = await fetch(baseUrl + "/api/createDoc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
      developer_email: developerEmail,
      api_key: apiKey,
      type: input.documentType === "receipt" ? 400 : 300,
      transaction_id: input.idempotencyKey,
      date: formatDate(input.documentDate),
      lang: "he",
      main_currency_iso: "ILS",
      description: input.description || undefined,
      customer_name: input.customerName,
      customer_email: input.customerEmail || undefined,
      customer_crn: input.customerCrn || undefined,
      customer_phone: input.customerPhone || undefined,
      item:
        input.documentType === "proforma"
          ? [
              {
                details: input.description,
                price: input.amount,
                amount: 1,
              },
            ]
          : undefined,
      payment:
        input.documentType === "receipt" ? [buildPayment(input)] : undefined,
      vat: input.documentType === "proforma" ? 0 : undefined,
      price_total: input.amount,
      pay_until:
        input.documentType === "proforma" && input.dueDate
          ? formatDate(input.dueDate)
          : undefined,
      comment: input.description || undefined,
      dont_send_email: input.sendEmail && input.customerEmail ? 0 : 1,
      send_copy: 1,
      print_type: "PDF",
      }),
      signal: AbortSignal.timeout(35000),
    });
  } catch {
    // The request may have reached EasyCount. The caller must retain the same
    // transaction_id/idempotency key for any later reconciliation or retry.
    throw new EzcountUncertainError(
      "לא התקבל אישור מ-EasyCount. יש לבדוק את המסמך לפני ניסיון נוסף.",
    );
  }

  const parsedResult = ezcountResponseSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (!parsedResult.success) {
    throw new EzcountUncertainError(
      "EasyCount החזיר תשובה לא תקינה. יש לבדוק את המסמך בחשבון.",
    );
  }
  const result = parsedResult.data;
  if (!response.ok || !result.success) {
    const detail = result.errMsg || "EasyCount לא הצליח להפיק את הקבלה";
    throw new Error(detail);
  }

  if (!result.doc_uuid || !result.doc_number || !result.pdf_link) {
    throw new EzcountUncertainError(
      "EasyCount החזיר תשובה חלקית. יש לבדוק את המסמך בחשבון.",
    );
  }

  return {
    docNumber: String(result.doc_number),
    docUuid: result.doc_uuid,
    pdfLink: result.pdf_link,
  };
}
