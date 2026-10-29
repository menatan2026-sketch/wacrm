import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import pino, { type Logger } from "pino";

/** Correlation fields attached to every log line emitted inside a context. */
export interface LogContext {
  request_id?: string;
  user_id?: string;
  org_id?: string;
  order_id?: string;
  job_id?: string;
  supplier_id?: string;
}

const storage = new AsyncLocalStorage<LogContext>();

export function withLogContext<T>(ctx: LogContext, fn: () => T): T {
  const parent = storage.getStore() ?? {};
  return storage.run({ ...parent, ...ctx }, fn);
}

export function currentLogContext(): LogContext {
  return storage.getStore() ?? {};
}

/** Hash personal identifiers so logs can correlate without storing them. */
export function hashPii(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 16);
}

const REDACT_PATHS = [
  "password",
  "*.password",
  "token",
  "*.token",
  "code",
  "*.code",
  "email",
  "*.email",
  "phone",
  "*.phone",
  "address",
  "*.address",
  "authorization",
  "*.authorization",
  "cookie",
  "*.cookie",
  "headers.cookie",
  "headers.authorization",
];

export function createLogger(
  options: { name: string; level?: string; destination?: pino.DestinationStream } = { name: "mfg" },
): Logger {
  return pino(
    {
    name: options.name,
    level: options.level ?? process.env.LOG_LEVEL ?? "info",
    redact: { paths: REDACT_PATHS, censor: "[redacted]" },
    mixin: () => ({ ...currentLogContext() }),
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    },
    options.destination,
  );
}

let root: Logger | undefined;

export function logger(): Logger {
  root ??= createLogger({ name: "mfg" });
  return root;
}

export type { Logger };
