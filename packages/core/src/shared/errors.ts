/**
 * Typed domain error. `code` is a stable, namespaced key ("orders.invalid_transition")
 * that the UI translates via the `errors` catalog. Raw messages never reach users.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 410 | 422 | 429 | 500 = 400,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = "DomainError";
  }
}

export const forbidden = (details?: Record<string, unknown>) => new DomainError("auth.forbidden", 403, details);
export const notFound = (what: string) => new DomainError("common.not_found", 404, { what });
export const invalid = (code: string, details?: Record<string, unknown>) => new DomainError(code, 422, details);
export const conflict = (code: string, details?: Record<string, unknown>) => new DomainError(code, 409, details);

/** Every error code the domain may raise. Checked against the `errors` catalog in CI. */
export const ERROR_CODES = [
  "auth.forbidden",
  "auth.unauthenticated",
  "auth.code_invalid",
  "auth.code_expired",
  "auth.too_many_attempts",
  "auth.rate_limited",
  "auth.mfa_required",
  "auth.mfa_invalid",
  "auth.no_access_to_surface",
  "auth.invitation_invalid",
  "common.not_found",
  "common.validation",
  "common.conflict",
  "common.idempotency_conflict",
  "common.unexpected",
  "files.type_not_allowed",
  "files.too_large",
  "files.upload_expired",
  "files.size_mismatch",
  "files.not_uploaded",
  "files.quota_exceeded",
  "orders.invalid_transition",
  "orders.on_hold",
  "orders.incomplete",
  "orders.not_cancellable",
  "drafts.expired",
  "quotes.not_payable",
  "quotes.expired",
  "pricing.no_active_rules",
  "pricing.activation_requires_second_person",
  "pricing.invalid_rules",
  "routing.no_candidates",
  "jobs.offer_not_pending",
  "jobs.invalid_transition",
  "jobs.evidence_incomplete",
  "payments.amount_mismatch",
  "payments.webhook_invalid",
  "payments.refund_exceeds_captured",
  "payments.refund_requires_approval",
  "shipping.invalid_transition",
  "suppliers.onboarding_incomplete",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
