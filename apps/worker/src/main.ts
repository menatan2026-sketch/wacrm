import { Queue, Worker } from "bullmq";
import { serverConfig } from "@mfg/config";
import { createPlatform, dispatchEvent, relayOutbox, SCHEDULED_TASKS, systemCtx, type DomainEvent } from "@mfg/core";
import { sql } from "@mfg/db";
import { logger, withLogContext } from "@mfg/logging";

const config = serverConfig();
const platform = createPlatform(config, { rootDir: process.env.MFG_ROOT });
const { deps } = platform;
const log = logger().child({ component: "worker" });
const connection = platform.redis;
const QUEUE = "events";

const queue = new Queue<DomainEvent>(QUEUE, {
  connection,
  defaultJobOptions: { attempts: 8, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 1000, removeOnFail: 5000 },
});

/** Outbox relay: committed events → BullMQ (jobId = event id, so re-delivery is de-duplicated). */
async function relayLoop(signal: AbortSignal) {
  while (!signal.aborted) {
    try {
      const n = await relayOutbox(deps.db, async (event) => {
        await queue.add(event.type, event, { jobId: event.id });
      });
      if (n === 0) await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      log.error({ err }, "outbox relay failed");
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

const worker = new Worker<DomainEvent>(
  QUEUE,
  async (job) => {
    const event = { ...job.data, createdAt: new Date(job.data.createdAt) };
    await withLogContext({ request_id: event.requestId ?? undefined }, () => dispatchEvent(deps, event));
  },
  { connection, concurrency: 4 },
);
worker.on("failed", (job, err) => log.error({ err, eventType: job?.name, eventId: job?.id, attempts: job?.attemptsMade }, "event handler failed"));

/** Each scheduled task runs on one worker at a time (Postgres advisory lock keyed by task name). */
function schedule(signal: AbortSignal) {
  for (const task of SCHEDULED_TASKS) {
    const tick = async () => {
      const lock = await deps.db.execute(sql`SELECT pg_try_advisory_lock(hashtext(${task.name})) AS ok`);
      if (!(lock.rows[0] as { ok: boolean }).ok) return;
      try {
        const result = await task.run(deps, systemCtx(deps));
        log.debug({ task: task.name, result }, "scheduled task done");
      } catch (err) {
        log.error({ err, task: task.name }, "scheduled task failed");
      } finally {
        await deps.db.execute(sql`SELECT pg_advisory_unlock(hashtext(${task.name}))`);
      }
    };
    const timer = setInterval(() => void tick(), task.everyMs);
    signal.addEventListener("abort", () => clearInterval(timer));
    void tick();
  }
}

const controller = new AbortController();
void relayLoop(controller.signal);
schedule(controller.signal);
log.info({ tasks: SCHEDULED_TASKS.map((t) => t.name) }, "worker started");

async function shutdown(signal: string) {
  log.info({ signal }, "worker shutting down");
  controller.abort();
  await worker.close();
  await queue.close();
  await platform.close();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
