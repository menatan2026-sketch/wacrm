import type { Deps } from "./deps";
import { purgeAbandonedFiles } from "./modules/files/service";
import { expireQuotes } from "./modules/quotes/service";
import { expireOffers } from "./modules/routing/service";
import { autoCompleteDelivered, syncTracking } from "./modules/shipping/service";
import { recomputeSupplierStats } from "./modules/suppliers/service";
import { SYSTEM, type Ctx } from "./shared/context";

export interface ScheduledTask {
  name: string;
  everyMs: number;
  run: (d: Deps, ctx: Ctx) => Promise<unknown>;
}

const MIN = 60_000;

/** Periodic jobs (ARCHITECTURE §10). The worker runs each under a Postgres advisory lock. */
export const SCHEDULED_TASKS: ScheduledTask[] = [
  { name: "quotes.expire", everyMs: 5 * MIN, run: expireQuotes },
  { name: "offers.expire", everyMs: MIN, run: expireOffers },
  { name: "shipping.sync", everyMs: 15 * MIN, run: syncTracking },
  { name: "orders.auto_complete", everyMs: 60 * MIN, run: (_d, ctx) => autoCompleteDelivered(ctx) },
  { name: "suppliers.stats", everyMs: 60 * MIN, run: (_d, ctx) => recomputeSupplierStats(ctx) },
  { name: "files.purge", everyMs: 24 * 60 * MIN, run: purgeAbandonedFiles },
];

export const systemCtx = (d: Deps): Ctx => ({ db: d.db, actor: SYSTEM, clock: d.clock });
