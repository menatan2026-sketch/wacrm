import { randomBytes } from "node:crypto";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

export { schema };
export type Schema = typeof schema;
export type Db = NodePgDatabase<Schema>;
/** A transaction handle; accepted anywhere a Db is. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

// pg returns int8 as string by default; amounts fit safely in JS numbers (< 2^53 agorot).
pg.types.setTypeParser(20, (v) => Number(v));
// numeric -> number (dimensions, rates); precision is bounded by column definitions.
pg.types.setTypeParser(1700, (v) => Number(v));

export function createPool(connectionString: string, max = 10): pg.Pool {
  return new pg.Pool({ connectionString, max });
}

export function createDb(pool: pg.Pool): Db {
  return drizzle(pool, { schema });
}

/** RFC 9562 UUIDv7: time-ordered, so primary keys stay index-friendly. */
export function uuidv7(now: number = Date.now()): string {
  const bytes = randomBytes(16);
  const ms = BigInt(now);
  for (let i = 0; i < 6; i++) bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn);
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export * from "./schema/enums";
export type * from "./schema/index";
export * from "drizzle-orm";
