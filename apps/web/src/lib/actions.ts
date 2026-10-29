import "server-only";
import { ZodError } from "zod";
import { DomainError } from "@mfg/core";
import { logger } from "@mfg/logging";
import { requestMeta } from "./session";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: string; ref?: string; details?: Record<string, unknown> };

/**
 * Wrap a server action: domain errors become translated error codes; anything unexpected is
 * logged with the request id and shown to the user only as a reference code (no raw errors).
 */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === "NEXT_REDIRECT" ||
        (err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT"))
    )
      throw err;
    if (err instanceof DomainError)
      return { ok: false, code: err.code, details: safeDetails(err.details) };
    if (err instanceof ZodError)
      return {
        ok: false,
        code: "common.validation",
        details: { fields: err.issues.map((i) => i.path.join(".")) },
      };
    const { requestId } = await requestMeta();
    logger().error({ err, request_id: requestId }, "server action failed");
    return { ok: false, code: "common.unexpected", ref: requestId };
  }
}

function safeDetails(details: Record<string, unknown>): Record<string, unknown> {
  // Only pass through primitive, non-sensitive hints (field names, limits).
  return Object.fromEntries(
    Object.entries(details).filter(
      ([, v]) => ["string", "number", "boolean"].includes(typeof v) || Array.isArray(v),
    ),
  );
}
