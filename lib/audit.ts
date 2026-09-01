import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";

export async function writeAuditLog(input: {
  ownerUserId: string;
  action: string;
  entityType: string;
  entityId?: string;
  outcome?: "success" | "failure";
  metadata?: Record<string, string | number | boolean | null>;
}) {
  await getDb()
    .insert(auditLogs)
    .values({
      id: crypto.randomUUID(),
      ownerUserId: input.ownerUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      outcome: input.outcome ?? "success",
      metadataJson: JSON.stringify(input.metadata ?? {}),
      createdAt: new Date().toISOString(),
    })
    .catch(() => undefined);
}
