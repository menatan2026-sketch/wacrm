import { schema, and, eq } from "@mfg/db";
import type { Deps } from "./deps";
import type { DomainEvent } from "./platform/outbox";
import { onceForEvent, relayOutbox } from "./platform/outbox";
import { SYSTEM, type Ctx } from "./shared/context";
import { analyzeFile } from "./modules/geometry/service";
import {
  notifyCustomer,
  notifyEmail,
  notifySupplierJob,
  notifySupplierOffer,
} from "./modules/notifications/service";
import { proposeRouting } from "./modules/routing/service";

type Handler = (d: Deps, ctx: Ctx, event: DomainEvent) => Promise<void>;

/**
 * Event handlers run at least once; each runs at most once per event thanks to the
 * processed_events marker written in the handler's own transaction.
 */
export const HANDLERS: Record<string, { name: string; run: Handler; transactional: boolean }[]> = {
  "file.uploaded": [
    {
      name: "geometry.analyze",
      transactional: false,
      run: (d, ctx, e) => analyzeFile(d, ctx, String(e.payload.fileId)),
    },
  ],
  "order.paid": [
    {
      name: "routing.propose",
      transactional: false,
      run: async (d, ctx, e) => void (await proposeRouting(d, ctx, String(e.payload.orderId))),
    },
  ],
  "notify.customer": [
    {
      name: "notify.customer",
      transactional: true,
      run: (d, ctx, e) =>
        notifyCustomer(
          d,
          ctx,
          e.payload as { orderId: string; template: string; vars?: Record<string, unknown> },
        ),
    },
  ],
  "notify.supplier": [
    {
      name: "notify.supplier",
      transactional: true,
      run: (d, ctx, e) => notifySupplierOffer(d, ctx, String(e.payload.offerId)),
    },
  ],
  "notify.supplier_job": [
    {
      name: "notify.supplier_job",
      transactional: true,
      run: (d, ctx, e) =>
        notifySupplierJob(d, ctx, e.payload as { jobId: string; template: string }),
    },
  ],
  "notify.email": [
    {
      name: "notify.email",
      transactional: true,
      run: (d, _ctx, e) =>
        notifyEmail(
          d,
          e.payload as {
            to: string;
            locale: string;
            template: string;
            vars: Record<string, string | number>;
          },
        ),
    },
  ],
};

export async function dispatchEvent(d: Deps, event: DomainEvent): Promise<void> {
  for (const h of HANDLERS[event.type] ?? []) {
    if (h.transactional) {
      await onceForEvent(d.db, h.name, event.id, (tx) =>
        h.run(
          d,
          {
            db: tx,
            actor: SYSTEM,
            clock: d.clock,
            requestId: event.requestId ?? undefined,
            inTransaction: true,
          },
          event,
        ),
      );
    } else {
      // Long-running handlers manage their own transactions; the marker is written after success.
      const done = await onceForEvent(
        d.db,
        `${h.name}:check`,
        event.id,
        async () => undefined,
      ).catch(() => false);
      if (!done) continue;
      try {
        await h.run(
          d,
          { db: d.db, actor: SYSTEM, clock: d.clock, requestId: event.requestId ?? undefined },
          event,
        );
      } catch (err) {
        // Allow a retry: remove the marker so the next delivery runs the handler again.
        await d.db
          .delete(schema.processedEvents)
          .where(
            and(
              eq(schema.processedEvents.handler, `${h.name}:check`),
              eq(schema.processedEvents.eventId, event.id),
            ),
          );
        throw err;
      }
    }
  }
}

/** Process every pending outbox event synchronously (tests, and the worker's relay fallback). */
export async function drainOutbox(d: Deps, maxRounds = 20): Promise<number> {
  let total = 0;
  for (let i = 0; i < maxRounds; i++) {
    const n = await relayOutbox(d.db, (e) => dispatchEvent(d, e), {
      now: new Date(d.clock.now().getTime() + 1),
    });
    total += n;
    if (n === 0) break;
  }
  return total;
}
