# Ritmo — Product Spec

## Role
You are a world-class team in one: principal software architect, senior full-stack engineer, mobile engineer, desktop/systems engineer, product designer (Apple/Linear/Stripe caliber), security engineer and QA lead. You make decisions like a CTO and build like a senior engineer: production-grade, secure, tested, and beautiful.

## Mission
Build **Ritmo (ריטמו)**, an all-in-one workforce management platform that beats Connecteam in every dimension: features, UX, design, speed, AI, pricing clarity, and especially **computer-based work tracking**, which Connecteam (a mobile-first, deskless-worker product) handles poorly.

Target customers: Israeli and international SMBs, 5–2,000 employees, mixed teams of field/frontline workers and office/remote computer workers. *(Owner: adjust if needed.)*

### Where we win (non-negotiable differentiators)
1. ONE platform, ONE clear price per user. No separately priced "hubs", no paywalled features teased in the UI.
2. Serves BOTH deskless workers (mobile) AND computer workers (desktop agent) in a single unified timeline.
3. AI-native, not bolted on: every module has an AI layer that saves real manager time.
4. Design that feels like a premium consumer app, not enterprise software (see `docs/brand/BRAND.md`).
5. Hebrew/RTL as a first-class citizen + English, architecture ready for more languages.
6. Privacy-first, transparent monitoring that employees trust.

## Platforms
- Web admin dashboard (managers/admins), responsive.
- Mobile app for employees and managers (iOS + Android).
- Desktop tracking agent (Windows + macOS, Linux optional).
- Public REST API + webhooks.

## User roles & permissions
Owner, Admin, Manager (scoped to teams/branches/departments), Employee, Contractor/Guest. Granular RBAC with custom roles, per-module permissions, and scoping by location/department/team. Every sensitive action is written to an immutable audit log.

## Modules

### 1. Time & Attendance
- Clock in/out: mobile (GPS + geofencing), shared kiosk/tablet mode with PIN or face verification, desktop agent, web, physical time-clock integration.
- Breaks (paid/unpaid), overtime rules, Israeli labor-law presets (configurable), rounding rules, shift differentials.
- Timesheets with manager approval flow; anomaly flags (missed punches, out-of-geofence, buddy-punching suspicion).
- Job/project/client time codes for billing.
- Payroll export: CSV/Excel + integrations (e.g. Hilan, Michpal, Synel; plus international options).

### 2. Scheduling
- Drag-and-drop scheduler (day/week/month, by employee/role/location).
- AI auto-scheduling: respects availability, skills/certifications, labor rules, budget, fairness and preferences; explains its decisions.
- Shift templates, open shifts, shift swap/claim marketplace with approval rules, availability submission, conflict detection.
- Real-time labor cost forecasting vs. budget.
- Calendar sync (Google/Outlook).

### 3. Tasks, Jobs & Field Operations
- Tasks and recurring tasks, checklists, sub-tasks, due dates, priorities, attachments, photo proof.
- Job dispatch with map view, routes, customer/site records, job status tracking.
- Kanban, list and calendar views.

### 4. Forms, Checklists & Reports
- No-code form builder (conditional logic, signatures, photos, GPS stamp, scoring).
- Voice-to-form filling with AI; auto-generated PDF reports.
- Inspection/safety/incident workflows with escalation.

### 5. Communication
- Real-time chat (1:1, groups, channels), threads, reactions, read receipts, file sharing, voice notes, AI live translation.
- Company feed/announcements with targeting, mandatory-read confirmation, scheduling, analytics.
- Employee directory with org chart.
- Surveys, polls, pulse checks, anonymous feedback, suggestion box.
- Events with RSVP.

### 6. HR & People
- Digital onboarding flows, document collection, e-signature, document-expiry alerts.
- Employee profiles, custom fields, employment history.
- Time off: policies, accruals, balances, negative-balance limits, approval chains, team calendar.
- Expense claims with receipt OCR.
- Recognition & rewards (badges, points, redeemable rewards).
- Internal help desk / HR ticketing.
- Lightweight performance reviews and 1:1 notes.

### 7. Learning & Knowledge
- Knowledge base (wiki) with AI search ("ask the handbook").
- Course builder + AI course generator from documents, quizzes, certifications with expiry, completion tracking.

### 8. Computer activity tracking (key differentiator — build with extra care)
A lightweight native desktop agent (prefer Tauri/Rust or similar; < 50 MB RAM idle, negligible CPU, battery-friendly).
- Automatic time tracking linked to projects/tasks/clients; start/stop from tray/menu bar.
- Active vs. idle detection with configurable thresholds; idle-time prompt ("what were you doing?").
- App & website usage by category (productive/neutral/unproductive, configurable per team/role).
- OPTIONAL screenshots at configurable intervals, blurred by default; the employee sees every capture and can delete within a grace window if policy allows.
- Offline mode with an encrypted local queue and sync.
- Productivity insights: focus time, context switching, meeting load, burnout-risk signals, trends — framed as team/self-improvement, not surveillance.
- Unified timeline merging desktop activity + mobile clock-ins + scheduled shifts.
- Auto-update, silent install via MDM (Intune/Jamf), tamper detection.

**Privacy & legal guardrails (mandatory)**
- Fully transparent: visible tray icon, clear indicator while tracking is active, no stealth mode.
- Never capture keystroke content, passwords, private messages, or personal-time activity; tracking only during clocked-in work hours.
- Employees have a personal dashboard showing exactly what is collected about them.
- Admin-configurable data retention, explicit consent flow, and a monitoring-policy notice employees must acknowledge.
- Built to comply with the Israeli Privacy Protection Law and its regulations, GDPR and comparable laws; data minimization by default.

### 9. Analytics & Reporting
- Real-time executive dashboard: attendance, labor cost, overtime, productivity, task completion, engagement, training compliance.
- Custom report builder, scheduled email reports, exports (PDF/Excel/CSV).
- AI insights in natural language ("Why was overtime up 18% in the Haifa branch last week?").

### 10. AI layer (cross-cutting)
- In-app assistant: managers ask questions and give commands in Hebrew or English ("schedule next week for the Tel Aviv branch, keep under budget").
- Smart suggestions, anomaly detection, auto-summaries of chats/reports, content drafting for announcements.
- Every AI action is previewable and reversible; never auto-executes destructive actions.

### 11. Admin & Platform
- Multi-company/multi-branch; white-label option (logo, colors, custom domain).
- SSO (Google, Microsoft, SAML), 2FA, SCIM provisioning.
- Billing: simple per-user pricing, free tier for small teams, trials, Stripe (or local provider).
- Integrations: Google Workspace, Microsoft 365, Slack, Zapier/Make, payroll systems, accounting; open REST API + webhooks with docs.
- Self-serve setup wizard: a company is fully operational within 10 minutes.

## Design
Follow `docs/brand/BRAND.md`, `design/tokens.json` and the reference screens in `docs/screens/` exactly. Summary: calm, precise, Linear/Stripe-level craft; warm paper + Ritmo Green + one lime "pulse"; IBM Plex Sans Hebrew + Plex Mono; one sheet with hairlines instead of card soup; motion per `docs/brand/MOTION.md` (120–260ms, no bounce, signature clock-in); full RTL; light and dark; WCAG 2.2 AA + IS 5568; performance budgets — web LCP < 2s, interactions < 100ms, mobile cold start < 2s.

## Recommended tech stack (adjust only with written justification)
- Web: Next.js (App Router) + TypeScript + Tailwind v4 (theme in `design/tailwind-theme.css`) + shadcn/ui restyled to the tokens + Motion (Framer Motion) with the presets in `design/motion.ts`.
- Mobile: React Native (Expo) + TypeScript + Reanimated 3 + Gesture Handler + expo-haptics, sharing types/logic with web in a monorepo (Turborepo + pnpm).
- Desktop agent: Tauri (Rust core) + shared UI.
- Backend: PostgreSQL (e.g. Supabase) with Row-Level Security for strict multi-tenancy, realtime subscriptions, object storage, edge/serverless functions, a background job queue.
- AI: provider-agnostic LLM layer with prompt templates and evaluations.
- Infra: CI/CD, staging + production, error monitoring (Sentry), observability, automated backups.

## Security & quality
- Tenant isolation enforced at the database level; encryption in transit and at rest; secrets management; rate limiting; OWASP Top 10 coverage.
- Automated tests: unit, integration, and E2E for critical flows (clock-in, scheduling, payroll export, tracking sync).
- Seed data and a demo company ("Café Alma", 3 branches, 42 employees — as in the reference screens).
- Clean architecture, typed end to end, documented code, README and setup scripts.

## Phases (stop for review after each)
- **Phase 0** — Clarifying questions; architecture document; data model (ERD); monorepo folder structure; design tokens wired into a shared `packages/ui`; screen map.
- **Phase 1 (MVP)** — Auth, multi-tenancy, roles, employee management, time clock (web + mobile) with the clock-in choreography, basic scheduling, chat, manager dashboard (`docs/screens/01-manager-dashboard.html`), design system components, states and motion (`docs/screens/05-states-and-motion.html`).
- **Phase 2** — Desktop tracking agent, unified timeline, productivity dashboard, privacy controls and the employee "What's collected" page (`docs/screens/04-desktop-tracking.html`).
- **Phase 3** — Full scheduling (`docs/screens/02-weekly-schedule.html`), tasks/jobs, forms, time off, documents & onboarding, announcements, full employee app (`docs/screens/03-employee-mobile.html`).
- **Phase 4** — AI layer, analytics & report builder, training/LMS, knowledge base.
- **Phase 5** — Integrations, public API, billing, white-label, hardening and performance.

For each phase: show the plan first, then implement, then list what was done, how to run/test it, known limitations, and what's next. Prefer working, tested, polished features over many half-finished ones.

## Definition of Done (per feature)
Works on all target platforms; RTL + LTR verified; light + dark mode; responsive; accessible; loading/empty/error states designed; permissions enforced; tests passing; no console errors.
