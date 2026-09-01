import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { businessDocuments, clients, payments } from "@/db/schema";
import {
  EzcountUncertainError,
  getEzcountStatus,
  issueReceipt,
} from "@/services/easycount";
import { authenticatedOwnerId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  documentTypeLabel,
  paymentMethodLabel,
  receiptInputSchema,
  type ReceiptInput,
} from "@/lib/receipt-schema";

function clientDocument(row: typeof businessDocuments.$inferSelect) {
  return {
    id: row.id,
    clientId: row.clientId,
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
  const message = error.message
    .replace(/(?:api[_ -]?key|authorization|bearer)\s*[:=]?\s*\S+/gi, "[מידע חסוי]")
    .replace(/\s+/g, " ")
    .trim();
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

const storedPaymentMethods: Record<number, string> = {
  1: "cash",
  2: "check",
  3: "credit_card",
  4: "bank_transfer",
  9: "other",
  91: "other",
};

async function savePayment(ownerUserId: string, input: ReceiptInput, now: string) {
  if (input.documentType !== "receipt") return;
  await getDb().insert(payments).values({
    id: input.idempotencyKey + ":payment",
    ownerUserId,
    documentId: input.idempotencyKey,
    paymentDate: input.paymentDate || input.documentDate,
    amountAgorot: Math.round(input.amount * 100),
    paymentMethod: storedPaymentMethods[input.paymentType] ?? "other",
    transactionType: "credit",
    reference: input.paymentReference || null,
    notes: input.notes || null,
    cardType: input.paymentType === 3 ? input.cardType : null,
    cardLastFour: input.paymentType === 3 ? input.cardLastFour : null,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();
}

export async function GET(request: Request) {
  const currentOwnerId = authenticatedOwnerId(request);
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
  const currentOwnerId = authenticatedOwnerId(request);
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

  const input = parsed.data;
  const db = getDb();
  const now = new Date().toISOString();
  const easycountStatus = getEzcountStatus();
  const initialStatus = easycountStatus.configured ? "pending" : "draft";

  if (input.clientId) {
    const [ownedClient] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, input.clientId), eq(clients.ownerUserId, currentOwnerId)))
      .limit(1);
    if (!ownedClient) {
      return Response.json({ error: "הלקוח שנבחר אינו זמין" }, { status: 400 });
    }
  }

  try {
    const inserted = await db
      .insert(businessDocuments)
      .values({
        id: input.idempotencyKey,
        ownerUserId: currentOwnerId,
        clientId: input.clientId || null,
        customerName: input.customerName,
        customerEmail: input.customerEmail || null,
        customerPhone: input.customerPhone || null,
        customerCrn: input.customerCrn || null,
        documentType: input.documentType,
        amountAgorot: Math.round(input.amount * 100),
        documentDate: input.documentDate,
        paymentDate: input.documentType === "receipt" ? input.paymentDate || input.documentDate : null,
        transactionType: input.documentType === "receipt" ? "credit" : null,
        dueDate: input.dueDate || null,
        paymentType: input.documentType === "receipt" ? input.paymentType : null,
        paymentDetailsJson: storedPaymentSummary(input),
        description: input.description,
        notes: input.notes || null,
        status: initialStatus,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: businessDocuments.id });

    const [existing] = inserted.length
      ? [null]
      : await db
          .select()
          .from(businessDocuments)
          .where(
            and(
              eq(businessDocuments.id, input.idempotencyKey),
              eq(businessDocuments.ownerUserId, currentOwnerId),
            ),
          )
          .limit(1);

    if (!inserted.length && !existing) {
      return Response.json(
        { error: "מזהה המסמך כבר נמצא בשימוש" },
        { status: 409 },
      );
    }

    if (existing?.status === "issued") {
      return Response.json({ document: clientDocument(existing), duplicate: true });
    }

    if (
      existing &&
      (existing.customerName !== input.customerName ||
        existing.amountAgorot !== Math.round(input.amount * 100) ||
        existing.documentType !== input.documentType ||
        existing.documentDate !== input.documentDate)
    ) {
      return Response.json(
        { error: "מזהה המסמך כבר שויך למסמך אחר" },
        { status: 409 },
      );
    }

    if (!easycountStatus.configured) {
      const [draft] = existing
        ? [existing]
        : await db
            .select()
            .from(businessDocuments)
            .where(
              and(
                eq(businessDocuments.id, input.idempotencyKey),
                eq(businessDocuments.ownerUserId, currentOwnerId),
              ),
            )
            .limit(1);

      await savePayment(currentOwnerId, input, now);
      await writeAuditLog({ ownerUserId: currentOwnerId, action: "document.draft_saved", entityType: "document", entityId: input.idempotencyKey });
      return Response.json(
        {
          document: clientDocument(draft),
          duplicate: Boolean(existing),
          message: "הטיוטה נשמרה. זה אינו מסמך מס רשמי.",
        },
        { status: existing ? 200 : 201 },
      );
    }

    if (existing?.status === "pending") {
      return Response.json(
        { error: "המסמך כבר נמצא בתהליך הפקה", code: "DOCUMENT_IN_PROGRESS" },
        { status: 409 },
      );
    }

    if (existing) {
      const claimed = await db
        .update(businessDocuments)
        .set({ status: "pending", errorMessage: null, updatedAt: now })
        .where(
          and(
            eq(businessDocuments.id, input.idempotencyKey),
            eq(businessDocuments.ownerUserId, currentOwnerId),
            eq(businessDocuments.status, existing.status),
          ),
        )
        .returning({ id: businessDocuments.id });
      if (!claimed.length) {
        return Response.json(
          { error: "המסמך כבר נמצא בתהליך הפקה", code: "DOCUMENT_IN_PROGRESS" },
          { status: 409 },
        );
      }
    }

    await writeAuditLog({
      ownerUserId: currentOwnerId,
      action: "document.issue_attempted",
      entityType: "document",
      entityId: input.idempotencyKey,
      metadata: { environment: easycountStatus.environment },
    });
    const issued = await issueReceipt(input);
    await savePayment(currentOwnerId, input, now);
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
      .where(
        and(
          eq(businessDocuments.id, input.idempotencyKey),
          eq(businessDocuments.ownerUserId, currentOwnerId),
        ),
      )
      .returning();

    await writeAuditLog({
      ownerUserId: currentOwnerId,
      action: "document.issued",
      entityType: "document",
      entityId: input.idempotencyKey,
    });

    return Response.json(
      {
        document: clientDocument(saved),
        message: documentTypeLabel(input.documentType) + " הופקה בהצלחה",
      },
      { status: 201 },
    );
  } catch (error) {
    const message = errorMessage(error);
    const failureStatus =
      error instanceof EzcountUncertainError ? "unknown" : "failed";
    await db
      .update(businessDocuments)
      .set({
        status: failureStatus,
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

    await writeAuditLog({
      ownerUserId: currentOwnerId,
      action: "document.issue_failed",
      entityType: "document",
      entityId: input.idempotencyKey,
      outcome: "failure",
      metadata: { uncertain: error instanceof EzcountUncertainError },
    });

    return Response.json({ error: message }, { status: 502 });
  }
}
