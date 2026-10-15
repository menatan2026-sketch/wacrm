import postgres from 'postgres';

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;

let client: Sql | null = null;

/**
 * Shared pool. Connects as the low-privilege `ritmo_app` role; every query
 * that touches tenant data must go through `asUser` so RLS applies.
 * `prepare: false` keeps it compatible with transaction-mode poolers
 * (Supabase Supavisor / PgBouncer).
 */
export function db(): Sql {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    client = postgres(url, {
      prepare: false,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idle_timeout: 20,
      connect_timeout: 10,
      connection: { search_path: 'ritmo, ritmo_auth' },
      types: { bigint: postgres.BigInt },
      transform: { undefined: null },
    });
  }
  return client;
}

/**
 * Runs `fn` in a transaction as the signed-in user: switches to the
 * `ritmo_user` role and sets the JWT-style claim that `ritmo_auth.uid()`
 * reads, so Row-Level Security filters every statement.
 */
export async function asUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const result = await db().begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId })}, true)`;
    await tx`set local role ritmo_user`;
    return fn(tx);
  });
  return result as T;
}

/**
 * Runs `fn` as the server itself (role `ritmo_app`). It can only touch the
 * auth tables and call the few definer functions granted to it; tenant
 * tables are out of reach by design.
 */
export async function asApp<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const result = await db().begin(fn);
  return result as T;
}

export async function closeDb() {
  if (client) {
    await client.end({ timeout: 5 });
    client = null;
  }
}

/** Postgres error codes we map to user-facing messages. */
export function pgErrorCode(err: unknown): string | null {
  return typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : null;
}
