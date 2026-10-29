import { sql } from "drizzle-orm";
import { bigint, check, timestamp, uuid } from "drizzle-orm/pg-core";

export const id = () => uuid("id").primaryKey();
export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
export const ts = (name: string) => timestamp(name, { withTimezone: true });
/** Money is always integer minor units (agorot for ILS). */
export const minor = (name: string) => bigint(name, { mode: "number" });

/** CHECK (column IN (...)) for text-enum columns — easier to migrate than native enums. */
export function oneOf(name: string, column: string, values: readonly string[]) {
  const list = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
  return check(name, sql.raw(`"${column}" IN (${list})`));
}
