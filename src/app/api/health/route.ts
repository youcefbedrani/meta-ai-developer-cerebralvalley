import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";
import { getRedis } from "@/server/redis";

export const dynamic = "force-dynamic";

/** Liveness/readiness check for Docker and uptime monitors. Reveals no internals. */
export async function GET() {
  const checks: Record<string, "ok" | "fail"> = {};
  try {
    await getDb().execute(sql`select 1`);
    checks.database = "ok";
  } catch {
    checks.database = "fail";
  }
  try {
    checks.redis = (await getRedis().ping()) === "PONG" ? "ok" : "fail";
  } catch {
    checks.redis = "fail";
  }
  const healthy = Object.values(checks).every((c) => c === "ok");
  return NextResponse.json({ status: healthy ? "ok" : "degraded", checks }, { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } });
}
