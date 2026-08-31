import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { businessDocuments } from "@/db/schema";
import { getEzcountStatus, issueReceipt } from "@/lib/ezcount";
import {
  documentTypeLabel,
  paymentMethodLabel,
  receiptInputSchema,
  type ReceiptInput,
} from "@/lib/receipt-schema";

function ownerId(request: Request) {
  const authenticatedId = request.headers.get("oai-authenticated-user-id");
  if (authenticatedId) return authenticatedId;
  return process.env.NODE_ENV === "production" ? null : "local-preview";
}

function clientDocument(row: typeof businessDocuments.$inferSelect) {
  return {
    id: row.id,
    documentType: row.documentType,
    documentTypeLabel:
      row.documentType === "receipt" ? "קבלה" : "חשבונית עסקה",
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    amount: row.amountAgorot / 100,
    documentDate: row.documentDate,
    dueDate: row.dueDate,
    paymentType: row.paymentType,
    paymentTypeLabel:
      row.paymentType === null ? null : paymentMethodLabel(row.paymentType),
    description: row.description,
    status: row.status,
    docNumber: row.ezcountDocNumber,
    docUuid: row.ezcountDocUuid,
    pdfLink: row.pdfLink,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
  };
}

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return "אירעה שגיאה לא צפויה";
  const message = error.message.replace(/\s+/g, " ").trim();
  return message.slice(0, 500) || "אירעה שגיאה לא צפויה";
}

function storedPaymentSummary(input: ReceiptInput) {
  return JSON.stringify({
    webVendor: input.webVendor,
    cardType: input.cardType,
    cardLastFour: input.cardLastFour,
    otherPaymentName: input.otherPaymentName,
  });
}

export async function GET(request: Request) {
  const currentOwnerId = ownerId(request);
  if (!currentOwnerId) {
    return Response.json({ error: "נדרשת התחברות" }, { status: 401 });
  }

  try {
    const rows = await getDb()
      .select()
      .from(businessDocuments)
      .where(eq(businessDocuments.ownerUserId, currentOwnerId))
      .orderBy(desc(businessDocuments.createdAt))
      .limit(100);

    return Response.json({ documents: rows.map(clientDocument) });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const currentOwnerId = ownerId(request);
  if (!currentOwnerId) {
    return Response.json({ error: "נדרשת התחברות" }, { status: 401 });
  }

  const parsed = receiptInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return Response.json(
      {
        error: firstIssue?.message || "חסרים פרטים במסמך",
        field: firstIssue?.path[0] || null,
      },
      { status: 400 },
    );
  }

  if (!getEzcountStatus().configured) {
    return Response.json(
      {
        error: "המערכת מוכנה, אך EasyCount עדיין לא מחובר",
        code: "EZCOUNT_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const input = parsed.data;
  const db = getDb();
  const now = new Date().toISOString();

  try {
    const [existing] = await db
      .select()
      .from(businessDocuments)
      .where(
        and(
          eq(businessDocuments.id, input.idempotencyKey),
          eq(businessDocuments.ownerUserId, currentOwnerId),
        ),
      )
      .limit(1);

    if (existing?.status === "issued") {
      return Response.json({ document: clientDocument(existing), duplicate: true });
    }

    if (
      existing &&
      (existing.customerName !== input.customerName ||
        existing.amountAgorot !== Math.round(input.amount * 100) ||
        existing.documentType !== input.documentType)
    ) {
      return Response.json(
        { error: "מזהה המסמך כבר שויך למסמך אחר" },
        { status: 409 },
      );
    }

    if (existing) {
      await db
        .update(businessDocuments)
        .set({ status: "pending", errorMessage: null, updatedAt: now })
        .where(eq(businessDocuments.id, input.idempotencyKey));
    } else {
      await db.insert(businessDocuments).values({
        id: input.idempotencyKey,
        ownerUserId: currentOwnerId,
        customerName: input.customerName,
        customerEmail: input.customerEmail || null,
        customerPhone: input.customerPhone || null,
        customerCrn: input.customerCrn || null,
        documentType: input.documentType,
        amountAgorot: Math.round(input.amount * 100),
        documentDate: input.documentDate,
        dueDate: input.dueDate || null,
        paymentType: input.documentType === "receipt" ? input.paymentType : null,
        paymentDetailsJson: storedPaymentSummary(input),
        description: input.description,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
    }

    const issued = await issueReceipt(input);
    const [saved] = await db
      .update(businessDocuments)
      .set({
        status: "issued",
        ezcountDocNumber: issued.docNumber,
        ezcountDocUuid: issued.docUuid,
        pdfLink: issued.pdfLink,
        errorMessage: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(businessDocuments.id, input.idempotencyKey))
      .returning();

    return Response.json(
      {
        document: clientDocument(saved),
        message: documentTypeLabel(input.documentType) + " הופקה בהצלחה",
      },
      { status: 201 },
    );
  } catch (error) {
    const message = errorMessage(error);
    await db
      .update(businessDocuments)
      .set({
        status: "failed",
        errorMessage: message,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(businessDocuments.id, input.idempotencyKey),
          eq(businessDocuments.ownerUserId, currentOwnerId),
        ),
      )
      .catch(() => undefined);

    return Response.json({ error: message }, { status: 502 });
  }
}
