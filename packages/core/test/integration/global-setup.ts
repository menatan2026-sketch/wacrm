import pg from "pg";
import { runMigrations } from "@mfg/db/migrate";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://mfg@127.0.0.1:5432/mfg_test";

/** Fresh schema for every run: drop, migrate. Tests truncate between cases. */
export default async function setup() {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  await client.query(
    "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;",
  );
  await client.end();
  await runMigrations(TEST_DATABASE_URL);
}
