import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { businessDocuments, clients } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { authenticatedOwnerId } from "@/lib/auth";
import { clientInputSchema } from "@/lib/client-schema";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const ownerUserId = authenticatedOwnerId(request);
  if (!ownerUserId) return Response.json({ error: "נדרשת התחברות" }, { status: 401 });
  const { id } = await context.params;
  const [client] = await getDb().select().from(clients).where(and(eq(clients.id, id), eq(clients.ownerUserId, ownerUserId))).limit(1);
  if (!client || client.deletedAt) return Response.json({ error: "הלקוח לא נמצא" }, { status: 404 });
  return Response.json({ client });
}

export async function PATCH(request: Request, context: RouteContext) {
  const ownerUserId = authenticatedOwnerId(request);
  if (!ownerUserId) return Response.json({ error: "נדרשת התחברות" }, { status: 401 });
  const parsed = clientInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "פרטי הלקוח אינם תקינים" }, { status: 400 });
  const { id } = await context.params;
  try {
    const [client] = await getDb().update(clients).set({ ...parsed.data, updatedAt: new Date().toISOString() }).where(and(eq(clients.id, id), eq(clients.ownerUserId, ownerUserId), isNull(clients.deletedAt))).returning();
    if (!client) return Response.json({ error: "הלקוח לא נמצא" }, { status: 404 });
    await writeAuditLog({ ownerUserId, action: "client.updated", entityType: "client", entityId: id });
    return Response.json({ client });
  } catch {
    return Response.json({ error: "לא הצלחנו לעדכן את הלקוח" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const ownerUserId = authenticatedOwnerId(request);
  if (!ownerUserId) return Response.json({ error: "נדרשת התחברות" }, { status: 401 });
  const { id } = await context.params;
  const db = getDb();
  const [linkedDocument] = await db.select({ id: businessDocuments.id }).from(businessDocuments).where(and(eq(businessDocuments.ownerUserId, ownerUserId), eq(businessDocuments.clientId, id))).limit(1);
  const [client] = await db.update(clients).set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(clients.id, id), eq(clients.ownerUserId, ownerUserId))).returning();
  if (!client) return Response.json({ error: "הלקוח לא נמצא" }, { status: 404 });
  await writeAuditLog({ ownerUserId, action: "client.archived", entityType: "client", entityId: id, metadata: { retainedForHistory: Boolean(linkedDocument) } });
  return Response.json({ deleted: true, retainedForHistory: Boolean(linkedDocument) });
}
