# Security & Privacy Design

> Status: **Draft v0.1 — awaiting owner approval** · Phase 0A
> Principle: CAD files are customers' intellectual property. Frontend visibility is not security. Every authorization decision happens server-side.

## 1. Assets and threat model

| Asset | Why it matters | Primary threats |
|---|---|---|
| Customer CAD / model files, photos | IP, confidentiality, trust | IDOR, leaked/long-lived URLs, supplier over-retention, public bucket misconfiguration |
| Payment flow | Money, fraud | Webhook spoofing, amount tampering, replay, double capture, refund abuse |
| Supplier payouts | Money | Payout redirection (bank detail change fraud), ledger tampering |
| Pricing rules / margins | Business secret | Exposure through API responses, admin account takeover |
| Accounts (staff especially) | Control | Credential stuffing, phishing, session hijack, privilege escalation |
| Personal data (addresses, phones) | Privacy law | Over-collection, leakage to suppliers, logs containing PII |
| Geometry service | Parsing untrusted input | Malicious files (parser exploits, zip bombs, resource exhaustion) |
| AI features | Integrity | Prompt injection via user text/images, data leakage to providers, hallucinated status |

STRIDE review is required for each milestone that adds a trust boundary (uploads, payments, supplier access, webhooks, AI).

## 2. Authentication

- **Customers:** email + one-time code / magic link (passwordless default), optional password, optional passkeys later. Guest wizard drafts are bound to an anonymous token and claimed on sign-in.
- **Suppliers:** invite-only accounts. Email OTP + password. TOTP MFA required for `SUPPLIER_MANAGER` (because it can change payout details).
- **Staff (all admin roles):** SSO (Google Workspace / Microsoft OIDC) or password + **mandatory TOTP/WebAuthn MFA**. Session lifetime 12 h idle / 7 days max for customers; 8 h for staff. Re-authentication (step-up) for: refunds, payout detail changes, pricing rule activation, role grants, data exports.
- Library: chosen in the M0F spike (ADR-0010, candidates evaluated on org/role support, Postgres adapter, MFA, maintenance health). No hand-rolled crypto.
- Sessions: `HttpOnly`, `Secure`, `SameSite=Lax` cookies, host-only per surface (`ops.` cookies are never sent to `app.`), `__Host-` prefix. Rotation on privilege change. Server-side revocation list.
- Brute force: per-IP and per-account rate limits on OTP/login (Redis). Generic error messages. OTP codes single-use with ≤ 10 min TTL.

## 3. Authorization (RBAC + scope)

`can(actor, permission, resource)` lives in `packages/auth`. It is called in every application command/query. There is **no** "check in the UI only" path.

- **Roles:** `CUSTOMER`, `ENTERPRISE_ADMIN`, `SUPPLIER_OPERATOR`, `SUPPLIER_MANAGER`, `CAD_DESIGNER`, `QUALITY_REVIEWER`, `SUPPORT_AGENT`, `ADMIN`, `FINANCE_ADMIN`, `SUPER_ADMIN`.
- **Scope:** each role assignment has a scope (`platform`, `organization:<id>`, `supplier:<id>`). A supplier operator can act only on jobs assigned to their supplier. An enterprise admin can act only within their organization.
- **Ownership checks:** customers access only their own orders/files (or their organization's, with an org role).
- **Permission catalog** (excerpt, the full matrix is maintained in code with a generated doc):

| Permission | CUST | ENT_ADM | SUP_OP | SUP_MGR | CAD | QC | SUPPORT | ADMIN | FIN | SUPER |
|---|---|---|---|---|---|---|---|---|---|---|
| order.read.own | ✅ | ✅ org | — | — | — | — | — | — | — | — |
| order.read.any | — | — | — | — | assigned | ✅ | ✅ | ✅ | ✅ | ✅ |
| quote.override | — | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| pricing_rules.activate | — | — | — | — | — | — | — | — | ✅ (+ADMIN co-sign) | ✅ |
| routing.override | — | — | — | — | — | — | — | ✅ | — | ✅ |
| job.accept / job.update | — | — | ✅ own | ✅ own | — | — | — | ✅ | — | ✅ |
| job.file.download | — | — | ✅ active job | ✅ active job | ✅ assigned | ✅ | — | ✅ | — | ✅ |
| qc.verdict | — | — | — | — | — | ✅ | — | ✅ | — | ✅ |
| refund.create | — | — | — | — | — | — | request | ✅ ≤ limit | ✅ | ✅ |
| payout.details.update | — | — | — | ✅ (MFA + delay) | — | — | — | — | ✅ verify | ✅ |
| user.role.grant | — | ✅ org roles | — | ✅ own staff | — | — | — | ✅ (not SUPER) | — | ✅ |
| audit.read | — | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| flags.update | — | — | — | — | — | — | — | ✅ | — | ✅ |

- **Separation of duties:** activating a pricing rule set and raising a refund above a threshold require a second approver. Payout bank-detail changes trigger a 48 h hold plus out-of-band confirmation.
- Authorization is tested with a **permission matrix test**: every command × every role → expected allow/deny.

## 4. Files and CAD protection

- Private bucket(s), **block public access**, server-side encryption, versioning on, lifecycle rules per retention class.
- Uploads: presigned PUT with exact `Content-Length`, content-type, and a 5-minute expiry. The object key is random (no user input in keys). Files are quarantined (`scan_status=pending`) until validated by the geometry service (magic bytes, structure) and optionally an AV scanner (ClamAV container) for photos/documents.
- Downloads: presigned GET, **≤ 5 min** expiry, issued only after an authorization check, logged in `audit_events` (`file.download`) with actor and purpose.
- Suppliers: access only the **production file** (not the customer's original if not needed) for an **active** job. Access is revoked automatically at hand-off. Bulk download is rate limited. The supplier agreement includes confidentiality, a deletion obligation and audit rights.
- Images displayed in the browser go through a proxy route with an authorization check, or short-lived URLs, and never through public CDN URLs.
- Limits: 100 MB per model (configurable), 20 photos × 15 MB per request, per-user daily quota, triangle limit (e.g. 5 M) and analysis timeout (60 s).

## 5. Geometry sandbox

- Separate container, non-root, read-only root FS, no outbound network, CPU/memory/time limits, seccomp default profile.
- Receives bytes from the worker only (internal network, mTLS or shared-secret header). Never reachable from the internet.
- Parsers are pinned and dependency-scanned. Fuzz tests on malformed STL/3MF/OBJ in CI (Phase 1).
- 3MF is a ZIP: enforce compressed/uncompressed ratio and total size limits before extraction; reject path traversal.

## 6. Payments

- **Card data never touches our servers:** hosted payment page / hosted fields from the PSP (keeps scope to PCI DSS SAQ A).
- Amounts are always computed server-side from the quote snapshot. The client never sends an amount.
- Webhooks: signature/secret verification per provider docs, timestamp tolerance, de-duplication by provider event id, processing in a DB transaction, async heavy work. Unknown events are logged and ignored.
- Reconciliation job: compares provider status vs local status daily and on every ambiguous state. Discrepancies raise an admin alert.
- Idempotency keys on create/capture/refund. Refunds require a reason code, a permission and a threshold-based second approval.

## 7. Web application security

| Control | Implementation |
|---|---|
| Input validation | zod at every boundary (actions, route handlers, webhooks, AI outputs, job payloads) |
| SQL injection | Parameterized queries only (Drizzle). Raw SQL is reviewed and uses tagged templates |
| XSS | React escaping. No `dangerouslySetInnerHTML` except sanitized (DOMPurify) rich text. Strict CSP with nonces. User filenames are rendered as text and bidi-isolated |
| CSRF | Server actions' built-in origin check + SameSite cookies. Route handlers that mutate require a same-origin check or a custom header. Webhooks are exempt but signature-verified |
| Security headers | HSTS, CSP (enforced, not report-only, by MVP launch), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (camera allowed only on the upload route, for photo capture), `frame-ancestors 'none'` |
| SSRF | No user-supplied URLs fetched in the MVP. Future webhooks/integrations use an allow-list plus private-IP blocking (a lesson from wacrm GHSA-8jqh-598v-rfxc) |
| Rate limiting | Redis sliding window: auth, upload sessions, quote requests, AI calls, public endpoints |
| Open redirects | Redirect targets are allow-listed relative paths |
| Error handling | Typed error codes to the client. Stack traces only in logs |
| Dependencies | Renovate/Dependabot, `pnpm audit` / OSV scanner in CI, lockfile enforced, GitHub secret scanning + push protection, CodeQL |
| Containers | Minimal base images, Trivy scan in CI, pinned digests |

## 8. Secrets management

- Never committed. `.env.example` documents every variable with a placeholder. CI uses GitHub encrypted secrets / OIDC to the cloud. Production uses the cloud secrets manager.
- Per-environment keys. Rotation runbook. Provider credentials stored in the secrets manager, not the DB. Where tenant-specific secrets are unavoidable (e.g. a supplier's integration later), they are encrypted with AES-256-GCM using a KMS-managed key.

## 9. Privacy by design

- **Data minimization:** suppliers see job-relevant data only: part, material, quantity, deadline, QC requirements and the pickup location. **Never** customer name, phone or address unless the supplier ships directly (then the shipping label only).
- **Consent:** marketing consent is separate, opt-in and timestamped, and has no effect on operational messages. Analytics consent follows the cookie policy (first-party, minimal, no third-party ad trackers).
- **Rights:** self-service export (JSON + files ZIP) and deletion request. Deletion = anonymize personal fields, delete non-retained files, keep legally required financial records.
- **Retention:** per [DATABASE §7](./DATABASE.md#7-retention-initial-proposal--confirm-with-legal), enforced by scheduled purge jobs with audit.
- **AI:** customer content is sent to AI providers only when `AI_INTAKE` is on, under a no-training data-processing agreement, with PII stripped where feasible and disclosed in the privacy policy.
- **Logging:** a PII redaction allow-list. Emails/phones are hashed in logs. No file contents or addresses in logs.
- Regulatory basis: Israeli Protection of Privacy Law (incl. Amendment 13) and its database registration/security regulations. GDPR-ready structure. A DPA with every processor.

## 10. Audit

`audit_events` rows are written in the same transaction as the change for: authentication events, role changes, state transitions, overrides (price, routing, QC, material, process, AI output), refunds, payouts, file downloads, exports, flag changes and settings changes. Insert-only, partitioned, exportable, searchable in the admin.

## 11. AI-specific controls (Phase 6)

- Structured output only, validated against a zod schema. Invalid output → retry once → fall back to a manual queue.
- AI output is **advisory**: it can pre-fill requirements and draft briefs, but can't change price, payout, assignment or status.
- Prompt-injection hygiene: user content goes in delimited data sections, tools are not exposed to customer-text-driven agents, and outputs are never executed.
- The support assistant answers from tool calls against real status (read-only, scoped to the asking user). It must say "I don't know" instead of inventing.

## 12. Incident response (summary — full runbook in `OPERATIONS.md`, M5)

Severity levels, an on-call rotation (initially founders), status communication templates in he/en/ru, a breach-notification procedure per Israeli regulation, credential rotation, and a post-incident review within 5 business days.

## 13. Security review checklist (run at every milestone STEP 9)

- [ ] New endpoints: authn, authz (permission + scope), validation, rate limit, idempotency
- [ ] New data: classification, retention, redaction in logs, exposure to suppliers
- [ ] Files: private, signed, short-lived, audited
- [ ] External calls: provider port, timeouts, retries, webhook verification
- [ ] Permission matrix tests updated and passing
- [ ] Dependency and container scans clean (no high/critical without an accepted exception)
- [ ] Threat model delta recorded
