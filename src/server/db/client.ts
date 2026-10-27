import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: Database; __sql?: postgres.Sql };

/** Lazily-created singleton (survives dev hot reloads). */
export function getDb(): Database {
  if (!globalForDb.__db) {
    const sql = postgres(getEnv().DATABASE_URL, { max: 10, prepare: true, onnotice: () => {} });
    globalForDb.__sql = sql;
    globalForDb.__db = drizzle(sql, { schema, casing: "snake_case" });
  }
  return globalForDb.__db;
}

export { schema };
