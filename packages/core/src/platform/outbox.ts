import { schema, uuidv7, and, asc, eq, isNull, lte, sql, type Db } from "@mfg/db";
import type { Ctx } from "../shared/context";

export interface DomainEvent<T = Record<string, unknown>> {
  id: string;
  type: string;
  payload: T;
  requestId: string | null;
  createdAt: Date;
}

/** Write an event in the caller's transaction. It is published only if the transaction commits. */
export async function publish(
  ctx: Ctx,
  type: string,
  payload: Record<string, unknown>,
  delayMs = 0,
): Promise<string> {
  const id = uuidv7();
  await ctx.db.insert(schema.outboxEvents).values({
    id,
    type,
    payload,
    requestId: ctx.requestId ?? null,
    availableAt: new Date(ctx.clock.now().getTime() + delayMs),
  });
  return id;
}

/**
 * Claim up to `limit` unpublished events (SKIP LOCKED, so several relays can run) and hand
 * them to `deliver`. An event is marked published only after `deliver` succeeds.
 */
export async function relayOutbox(
  db: Db,
  deliver: (event: DomainEvent) => Promise<void>,
  opts: { limit?: number; now?: Date } = {},
): Promise<number> {
  const t = schema.outboxEvents;
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(t)
      .where(and(isNull(t.publishedAt), lte(t.availableAt, opts.now ?? new Date())))
      .orderBy(asc(t.availableAt))
      .limit(opts.limit ?? 100)
      .for("update", { skipLocked: true });
    for (const row of rows) {
      try {
        await deliver({
          id: row.id,
          type: row.type,
          payload: row.payload,
          requestId: row.requestId,
          createdAt: row.createdAt,
        });
        await tx.update(t).set({ publishedAt: new Date() }).where(eq(t.id, row.id));
      } catch (err) {
        await tx
          .update(t)
          .set({
            attempts: sql`${t.attempts} + 1`,
            lastError: String(err).slice(0, 500),
            availableAt: new Date(Date.now() + Math.min(60_000, 1000 * 2 ** row.attempts)),
          })
          .where(eq(t.id, row.id));
      }
    }
    return rows.length;
  });
}

/**
 * Run a handler at most once per (handler, event). The marker and the handler's writes share
 * one transaction, so a crash mid-handler simply retries.
 */
export async function onceForEvent(
  db: Db,
  handler: string,
  eventId: string,
  fn: (tx: Ctx["db"]) => Promise<void>,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(schema.processedEvents)
      .values({ handler, eventId })
      .onConflictDoNothing()
      .returning({ eventId: schema.processedEvents.eventId });
    if (inserted.length === 0) return false;
    await fn(tx);
    return true;
  });
}
