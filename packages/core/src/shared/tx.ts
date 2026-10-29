import type { Db } from "@mfg/db";
import type { Ctx } from "./context";

/** Run `fn` in a transaction, joining the caller's transaction if there already is one. */
export async function inTx<T>(ctx: Ctx, fn: (ctx: Ctx) => Promise<T>): Promise<T> {
  if (ctx.inTransaction) return fn(ctx);
  return (ctx.db as Db).transaction((tx) => fn({ ...ctx, db: tx, inTransaction: true }));
}
