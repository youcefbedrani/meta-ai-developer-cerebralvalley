import "server-only";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/server/db/client";
import type { UserId } from "@/server/data/user-id";

export type AdminActor = { id: UserId; email: string };

/** Appends one row to the admin audit log. Every admin mutation calls this. */
export async function logAdmin(actor: AdminActor, action: string, targetType: string, targetId: string | null, data?: Record<string, unknown>) {
  await getDb().insert(schema.adminAuditLog).values({ actorId: actor.id, actorEmail: actor.email, action, targetType, targetId, data: data ?? null });
}

export async function listAdminAudit({ q, type, limit = 100 }: { q?: string; type?: string; limit?: number }) {
  const a = schema.adminAuditLog;
  const where: SQL[] = [];
  if (type) where.push(eq(a.targetType, type));
  if (q) where.push(or(ilike(a.action, `%${q}%`), ilike(a.actorEmail, `%${q}%`), ilike(a.targetId, `%${q}%`))!);
  return getDb().select().from(a).where(where.length ? and(...where) : undefined).orderBy(desc(a.createdAt)).limit(limit);
}

export async function listMarketplaceAudit(limit = 100) {
  const m = schema.marketplaceAuditLog;
  return getDb()
    .select({ row: m, actorEmail: schema.users.email })
    .from(m)
    .leftJoin(schema.users, eq(schema.users.id, m.actorId))
    .orderBy(desc(m.createdAt))
    .limit(limit);
}
