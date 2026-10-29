import { mkdirSync, rmSync } from "node:fs";
import pg from "pg";

/** Staff accounts the specs sign in with; their MFA is reset so each run enrolls afresh. */
export const E2E_STAFF = ["admin@mfg.local"];
export const STATE_DIR = ".e2e-state";

export default async function globalSetup() {
  const url = process.env.DATABASE_URL ?? "postgres://mfg@127.0.0.1:5432/mfg";
  // Safety: only ever touch a local development database.
  if (!/@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url))
    throw new Error("E2E resets staff MFA and must run against a local dev database");
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  await pool.query(
    "UPDATE users SET mfa_enabled = false, mfa_secret = NULL WHERE email = ANY($1)",
    [E2E_STAFF],
  );
  await pool.end();
  rmSync(STATE_DIR, { recursive: true, force: true });
  mkdirSync(STATE_DIR, { recursive: true });
}
