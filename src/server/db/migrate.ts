/**
 * Applies pending migrations. Used by `pnpm db:migrate` (scripts/migrate.ts), the test setup and
 * (Iteration 6) the production container entrypoint.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import postgres from "postgres";

export async function runMigrations(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: path.join(process.cwd(), "src/server/db/migrations") });
  } finally {
    await sql.end();
  }
}
