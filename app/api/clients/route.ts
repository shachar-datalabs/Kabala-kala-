import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { authenticatedOwnerId } from "@/lib/auth";
import { clientInputSchema } from "@/lib/client-schema";

export async function GET(request: Request) {
  const ownerUserId = authenticatedOwnerId(request);
  if (!ownerUserId) return Response.json({ error: "נדרשת התחברות" }, { status: 401 });

  try {
    const rows = await getDb()
      .select()
      .from(clients)
      .where(and(eq(clients.ownerUserId, ownerUserId), isNull(clients.deletedAt)))
      .orderBy(asc(clients.name));
    return Response.json({ clients: rows });
  } catch {
    return Response.json({ error: "לא הצלחנו לטעון את הלקוחות" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ownerUserId = authenticatedOwnerId(request);
  if (!ownerUserId) return Response.json({ error: "נדרשת התחברות" }, { status: 401 });

  const parsed = clientInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "פרטי הלקוח אינם תקינים" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  try {
    const [client] = await getDb().insert(clients).values({
      id,
      ownerUserId,
      ...parsed.data,
      createdAt: now,
      updatedAt: now,
    }).returning();
    await writeAuditLog({ ownerUserId, action: "client.created", entityType: "client", entityId: id });
    return Response.json({ client }, { status: 201 });
  } catch {
    return Response.json({ error: "לא הצלחנו לשמור את הלקוח" }, { status: 500 });
  }
}
