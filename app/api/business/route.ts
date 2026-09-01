import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { businesses } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { authenticatedOwnerId } from "@/lib/auth";
import { businessInputSchema } from "@/lib/business-schema";

export async function GET(request: Request) {
  const ownerUserId = authenticatedOwnerId(request);
  if (!ownerUserId) return Response.json({ error: "נדרשת התחברות" }, { status: 401 });
  try {
    const [business] = await getDb().select().from(businesses).where(eq(businesses.ownerUserId, ownerUserId)).limit(1);
    return Response.json({ business: business ? { ...business, exemptDealerCeiling: business.exemptDealerCeilingAgorot === null ? null : business.exemptDealerCeilingAgorot / 100 } : null });
  } catch {
    return Response.json({ error: "לא הצלחנו לטעון את הגדרות העסק" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const ownerUserId = authenticatedOwnerId(request);
  if (!ownerUserId) return Response.json({ error: "נדרשת התחברות" }, { status: 401 });
  const parsed = businessInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "הגדרות העסק אינן תקינות" }, { status: 400 });
  const now = new Date().toISOString();
  const values = {
    businessName: parsed.data.businessName,
    ownerName: parsed.data.ownerName,
    businessNumber: parsed.data.businessNumber || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null,
    taxYear: parsed.data.taxYear ?? null,
    exemptDealerCeilingAgorot: parsed.data.exemptDealerCeiling == null ? null : Math.round(parsed.data.exemptDealerCeiling * 100),
    updatedAt: now,
  };
  try {
    const [business] = await getDb().insert(businesses).values({ id: crypto.randomUUID(), ownerUserId, ...values, createdAt: now }).onConflictDoUpdate({ target: businesses.ownerUserId, set: values }).returning();
    await writeAuditLog({ ownerUserId, action: "business.updated", entityType: "business", entityId: business.id });
    return Response.json({ business: { ...business, exemptDealerCeiling: business.exemptDealerCeilingAgorot === null ? null : business.exemptDealerCeilingAgorot / 100 } });
  } catch {
    return Response.json({ error: "לא הצלחנו לשמור את הגדרות העסק" }, { status: 500 });
  }
}
