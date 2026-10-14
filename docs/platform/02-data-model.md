# 02 · Data model (ERD)

> Phase 1 and 2 tables are specified column by column. Phase 3–5 tables
> are outlined (name, purpose, key relations) and get full detail in
> their phase plan.

## Conventions (apply to every table)

| Rule             | Detail                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary keys     | `uuid`, **UUIDv7** (time-ordered, good index locality). Generated client-side for offline-created rows (`time_events`, `messages`), server-side otherwise.                      |
| Tenancy          | Every tenant table has `org_id uuid NOT NULL`, RLS enabled, and indexes that lead with `org_id`.                                                                                |
| Composite FKs    | `UNIQUE (org_id, id)` on parent tables. Children reference `(org_id, parent_id)`, so cross-tenant links are impossible.                                                         |
| Time             | `timestamptz` (UTC) everywhere. Wall-clock concepts (shift templates, availability) use `time` + the location's IANA zone. `work_date date` is computed in the location's zone. |
| Money            | `bigint` minor units + `currency char(3)`. Rates are `numeric(12,4)`.                                                                                                           |
| Audit columns    | `created_at`, `updated_at` (trigger), `created_by` (member id) where meaningful.                                                                                                |
| Deletes          | Hard delete + audit row by default. `deleted_at` soft delete only where retention law needs it (time records, documents).                                                       |
| Balances         | Never a mutable number. Always a **ledger** (time-off accruals, recognition points) with a derived balance view.                                                                |
| Enums            | Postgres enums only for closed, stable sets (`member_status`). Open-ended sets use `text` + `CHECK`, or lookup tables.                                                          |
| Sensitive fields | Separate tables with stricter RLS; app-level encrypted (`bytea`, `_enc` suffix).                                                                                                |
| Large tables     | `time_events`, `activity_buckets`, `messages`, `audit_log` are range-partitioned by month.                                                                                      |

---

## A. Tenancy, identity & org structure (Phase 1)

```mermaid
erDiagram
  organizations ||--o{ legal_entities : has
  organizations ||--o{ locations : has
  organizations ||--o{ departments : has
  organizations ||--o{ teams : has
  organizations ||--o{ members : employs
  legal_entities ||--o{ locations : "employer of"
  departments ||--o{ departments : parent
  locations ||--o{ teams : "optional home"
  departments ||--o{ teams : "optional home"
  profiles ||--o{ members : "is (0..n orgs)"
  members ||--o{ team_memberships : in
  teams ||--o{ team_memberships : has
  members ||--o{ member_locations : "works at"
  locations ||--o{ member_locations : staffed_by
  members ||--o{ members : "reports to"
  members ||--o{ devices : uses
  members ||--o| member_sensitive : "has (restricted)"
  members ||--o{ employment_records : history
  members ||--o{ pay_rates : "paid (restricted)"
  organizations ||--o{ positions : defines
  members ||--o{ member_positions : qualified_for
  positions ||--o{ member_positions : held_by
  organizations ||--o{ custom_field_definitions : defines

  organizations {
    uuid id PK
    text name
    text slug UK
    char country_code "IL"
    text default_locale "he | en"
    text default_timezone "Asia/Jerusalem"
    smallint week_start "0=Sun"
    char currency "ILS"
    text data_region
    uuid partner_id FK "white-label, Phase 5"
    jsonb branding "logo, colors (Phase 5)"
    jsonb settings
    timestamptz created_at
  }
  legal_entities {
    uuid id PK
    uuid org_id FK
    text name
    text registration_no "company number"
    text deductions_file_no "payroll employer file"
    text payroll_provider "hilan | michpal | csv"
  }
  locations {
    uuid id PK
    uuid org_id FK
    uuid legal_entity_id FK
    text name
    text address
    text timezone
    geography geo_point "PostGIS"
    geography geofence "polygon or point+radius"
    int geofence_radius_m
    text geofence_mode "off | flag | block"
    bool kiosk_enabled
  }
  departments {
    uuid id PK
    uuid org_id FK
    uuid parent_id FK
    text name
    ltree path "fast subtree checks"
  }
  teams {
    uuid id PK
    uuid org_id FK
    uuid location_id FK
    uuid department_id FK
    text name
  }
  profiles {
    uuid user_id PK "= auth.users.id"
    text full_name
    text avatar_path
    text locale
    text phone_e164
    jsonb ui_prefs "theme, density"
  }
  members {
    uuid id PK
    uuid org_id FK
    uuid user_id FK "nullable: kiosk-only workers"
    text employee_no
    text first_name
    text last_name
    text display_name
    text email
    text phone_e164
    text member_type "employee | contractor | guest"
    text status "invited | active | suspended | terminated"
    text employment_type "full | part | hourly | shift"
    uuid department_id FK
    uuid primary_location_id FK
    uuid manager_member_id FK
    date hire_date
    date termination_date
    text kiosk_pin_hash "argon2id"
    jsonb custom_fields "validated vs definitions"
  }
  member_sensitive {
    uuid member_id PK
    uuid org_id FK
    bytea national_id_enc "Teudat Zehut"
    bytea bank_details_enc
    date birth_date
    text address
    jsonb emergency_contact
  }
  employment_records {
    uuid id PK
    uuid org_id FK
    uuid member_id FK
    daterange effective "EXCLUDE overlap"
    text job_title
    uuid department_id FK
    numeric fte
    text change_reason
  }
  pay_rates {
    uuid id PK
    uuid org_id FK
    uuid member_id FK
    daterange effective
    text pay_type "hourly | monthly | global"
    numeric rate
    char currency
  }
  positions {
    uuid id PK
    uuid org_id FK
    text name "Barista, Driver..."
    text color_token "shift palette key"
    numeric default_hourly_cost
  }
  member_positions {
    uuid member_id PK
    uuid position_id PK
    uuid org_id FK
    smallint proficiency
  }
  team_memberships {
    uuid team_id PK
    uuid member_id PK
    uuid org_id FK
    bool is_lead
  }
  member_locations {
    uuid member_id PK
    uuid location_id PK
    uuid org_id FK
  }
  devices {
    uuid id PK
    uuid org_id FK
    uuid member_id FK "null for shared kiosk"
    text kind "mobile | desktop | kiosk"
    text platform "ios | android | windows | macos | linux | web"
    text app_version
    text push_token
    text token_hash "device credential"
    timestamptz last_seen_at
    timestamptz revoked_at
  }
  custom_field_definitions {
    uuid id PK
    uuid org_id FK
    text entity "member | location | job"
    text key
    jsonb label "{he, en}"
    text type "text | number | date | select | file"
    jsonb options
    text visibility "all | managers | admins"
    bool required
  }
```

## B. Access control, audit & API (Phase 1)

```mermaid
erDiagram
  organizations ||--o{ roles : "custom roles"
  roles ||--o{ role_permissions : grants
  permissions ||--o{ role_permissions : in
  members ||--o{ role_assignments : holds
  roles ||--o{ role_assignments : assigned
  members ||--o{ member_visibility : "viewer"
  role_assignments ||--o{ member_visibility : derives
  organizations ||--o{ audit_log : records
  organizations ||--o{ api_keys : issues
  organizations ||--o{ invitations : sends
  organizations ||--o{ domain_events : emits

  permissions {
    text key PK "time.timesheets.approve"
    text module
    jsonb description
    bool self_applicable
  }
  roles {
    uuid id PK
    uuid org_id FK "null = system role"
    text key "owner | admin | manager | employee | contractor | guest | custom"
    jsonb name
    bool is_system
  }
  role_permissions {
    uuid role_id PK
    text permission_key PK
  }
  role_assignments {
    uuid id PK
    uuid org_id FK
    uuid member_id FK
    uuid role_id FK
    text scope_type "org | location | department | team"
    uuid scope_id "null when org"
    uuid granted_by FK
  }
  member_visibility {
    uuid org_id FK
    uuid viewer_member_id PK
    uuid target_member_id PK
    uuid role_assignment_id PK "precomputed by triggers"
  }
  invitations {
    uuid id PK
    uuid org_id FK
    uuid member_id FK
    text channel "email | sms | whatsapp | link"
    text token_hash
    timestamptz expires_at
    timestamptz accepted_at
  }
  audit_log {
    bigint id PK
    uuid org_id FK
    timestamptz occurred_at "partition key"
    text actor_type "member | system | api_key | ai | device"
    uuid actor_id
    text action "time_entry.edit"
    text target_type
    uuid target_id
    jsonb before
    jsonb after
    text reason
    inet ip
    text request_id
    bytea prev_hash
    bytea hash
  }
  api_keys {
    uuid id PK
    uuid org_id FK
    text key_prefix
    text key_hash "sha256"
    text_array scopes
    uuid created_by FK
    timestamptz last_used_at
    timestamptz expires_at
    timestamptz revoked_at
  }
  domain_events {
    uuid id PK
    uuid org_id FK
    text type "shift.published"
    int version
    jsonb payload
    timestamptz created_at
  }
```

## C. Time & attendance (Phase 1)

```mermaid
erDiagram
  members ||--o{ time_events : punches
  devices ||--o{ time_events : "recorded on"
  locations ||--o{ time_events : at
  members ||--o{ time_entries : works
  time_entries ||--o{ time_entry_breaks : contains
  time_entries }o--o| shifts : "fulfils"
  job_codes ||--o{ time_entries : "billed to"
  organizations ||--o{ attendance_policies : defines
  attendance_policies ||--o{ policy_assignments : "applies to"
  organizations ||--o{ timesheet_periods : runs
  timesheet_periods ||--o{ timesheets : contains
  members ||--o{ timesheets : submits
  timesheets ||--o{ timesheet_anomalies : flags
  time_entries ||--o{ timesheet_anomalies : "caused by"
  approval_requests ||--o{ approval_steps : has
  timesheet_periods ||--o{ payroll_exports : exported_as
  organizations ||--o{ pay_code_mappings : maps

  time_events {
    uuid id PK "client UUIDv7, idempotent"
    uuid org_id FK
    uuid member_id FK
    text type "clock_in | clock_out | break_start | break_end | job_switch"
    timestamptz occurred_at "device clock"
    timestamptz received_at "server clock"
    text source "mobile | web | kiosk | desktop | hardware | api | manager"
    uuid device_id FK
    uuid location_id FK
    uuid job_code_id FK
    geography position
    real accuracy_m
    bool inside_geofence
    text verification "none | pin | photo | face"
    text photo_path
    text_array flags "clock_skew, mock_location..."
    text note
  }
  time_entries {
    uuid id PK
    uuid org_id FK
    uuid member_id FK
    date work_date "in location tz"
    timestamptz started_at
    timestamptz ended_at "null = open"
    uuid location_id FK
    uuid job_code_id FK
    uuid shift_id FK
    text status "open | closed | approved | locked"
    int worked_minutes "generated"
    uuid_array source_event_ids
    bool manually_edited
    text edit_reason
  }
  time_entry_breaks {
    uuid id PK
    uuid org_id FK
    uuid time_entry_id FK
    timestamptz started_at
    timestamptz ended_at
    bool paid
    text kind "meal | rest | prayer | other"
  }
  job_codes {
    uuid id PK
    uuid org_id FK
    text code
    jsonb name
    uuid client_id FK "Phase 3 customers"
    bool billable
    numeric bill_rate
    bool active
  }
  attendance_policies {
    uuid id PK
    uuid org_id FK
    text name
    text preset "il_standard | custom"
    int version
    jsonb rules "zod-validated: OT tiers, rest day, night, rounding, breaks, auto clock-out, geofence"
    date effective_from
  }
  policy_assignments {
    uuid id PK
    uuid org_id FK
    uuid policy_id FK
    text scope_type "org | location | department | team | member"
    uuid scope_id
  }
  timesheet_periods {
    uuid id PK
    uuid org_id FK
    uuid legal_entity_id FK
    daterange period
    text status "open | review | locked | exported"
    timestamptz locked_at
    uuid locked_by FK
  }
  timesheets {
    uuid id PK
    uuid org_id FK
    uuid period_id FK
    uuid member_id FK
    text status "draft | submitted | approved | rejected"
    jsonb totals "regular, ot125, ot150, rest_day, night, paid_breaks, absences"
    int anomaly_count
    timestamptz computed_at
    uuid approval_request_id FK
  }
  timesheet_anomalies {
    uuid id PK
    uuid org_id FK
    uuid timesheet_id FK
    uuid time_entry_id FK
    text kind "missed_punch | out_of_geofence | long_shift | short_rest | ot_cap | late | early_leave | buddy_punch_suspect"
    text severity "info | warn | critical"
    jsonb details
    uuid resolved_by FK
    text resolution
  }
  approval_requests {
    uuid id PK
    uuid org_id FK
    text subject_type "timesheet | time_off | shift_swap | expense | time_entry_edit"
    uuid subject_id
    uuid requested_by FK
    text status "pending | approved | rejected | cancelled"
  }
  approval_steps {
    uuid id PK
    uuid org_id FK
    uuid approval_request_id FK
    smallint step_no
    uuid approver_member_id FK
    text decision
    text comment
    timestamptz decided_at
  }
  pay_code_mappings {
    uuid id PK
    uuid org_id FK
    uuid legal_entity_id FK
    text provider
    text hour_category "regular | ot125 | ot150 | rest_day | night | sick | vacation | reserve_duty"
    text external_code
  }
  payroll_exports {
    uuid id PK
    uuid org_id FK
    uuid period_id FK
    text provider
    text format "csv | xlsx | hilan | michpal"
    text file_path
    text sha256
    uuid created_by FK
    timestamptz created_at
  }
```

`approval_requests` is a **generic approval engine**. Timesheets, time-off,
shift swaps, expenses and retro edits all reuse it, with
multi-step chains defined per org.

## D. Scheduling (Phase 1 basic; Phase 4 AI)

```mermaid
erDiagram
  locations ||--o{ shifts : hosts
  positions ||--o{ shifts : "staffed as"
  members ||--o{ shifts : "assigned (null = open)"
  shift_templates ||--o{ shifts : generated
  shifts ||--o{ shift_requests : "swap/drop/claim"
  members ||--o{ availability : declares
  locations ||--o{ labor_budgets : budgets
  locations ||--o{ schedule_publications : publishes

  shifts {
    uuid id PK
    uuid org_id FK
    uuid location_id FK
    uuid position_id FK
    uuid member_id FK "null = open shift"
    tstzrange during "EXCLUDE overlap per member (btree_gist)"
    date work_date
    int unpaid_break_minutes
    text status "draft | published | cancelled"
    smallint open_slots "for open shifts needing N people"
    text notes
    uuid template_id FK
    bigint est_cost_minor
    timestamptz published_at
  }
  shift_templates {
    uuid id PK
    uuid org_id FK
    uuid location_id FK
    text name
    jsonb pattern "weekday, start time, end time, position, count"
  }
  availability {
    uuid id PK
    uuid org_id FK
    uuid member_id FK
    text kind "recurring | one_off"
    smallint weekday
    time start_time
    time end_time
    daterange valid
    text preference "unavailable | prefer_not | available | prefer"
    text note
  }
  shift_requests {
    uuid id PK
    uuid org_id FK
    text kind "swap | drop | claim"
    uuid shift_id FK
    uuid requester_member_id FK
    uuid counterpart_member_id FK
    uuid counterpart_shift_id FK
    text status "open | pending_approval | approved | rejected | expired"
    uuid approval_request_id FK
  }
  labor_budgets {
    uuid id PK
    uuid org_id FK
    uuid location_id FK
    daterange period
    bigint amount_minor
    numeric hours
  }
  schedule_publications {
    uuid id PK
    uuid org_id FK
    uuid location_id FK
    daterange week
    int version
    uuid published_by FK
    timestamptz published_at
    jsonb diff "what changed, drives notifications"
  }
```

## E. Chat (Phase 1)

```mermaid
erDiagram
  conversations ||--o{ conversation_members : has
  members ||--o{ conversation_members : joins
  conversations ||--o{ messages : contains
  messages ||--o{ messages : "thread replies"
  messages ||--o{ message_reactions : gets
  messages ||--o{ message_attachments : carries

  conversations {
    uuid id PK
    uuid org_id FK
    text kind "dm | group | channel"
    text name
    text topic
    bool is_private
    jsonb auto_membership "e.g. all of location X"
    uuid created_by FK
    timestamptz last_message_at
    timestamptz archived_at
  }
  conversation_members {
    uuid conversation_id PK
    uuid member_id PK
    uuid org_id FK
    text role "owner | admin | member"
    uuid last_read_message_id "read receipts"
    timestamptz last_read_at
    text notify "all | mentions | none"
  }
  messages {
    uuid id PK "client UUIDv7"
    uuid org_id FK
    uuid conversation_id FK
    uuid sender_member_id FK
    uuid parent_id FK "thread root"
    text kind "text | file | voice | system"
    text body
    text body_lang "detected, for AI translation"
    jsonb mentions
    timestamptz created_at "partition key"
    timestamptz edited_at
    timestamptz deleted_at
  }
  message_reactions {
    uuid message_id PK
    uuid member_id PK
    text emoji PK
    uuid org_id FK
  }
  message_attachments {
    uuid id PK
    uuid org_id FK
    uuid message_id FK
    text storage_path
    text mime
    bigint bytes
    int duration_ms "voice notes"
    text scan_status "pending | clean | infected"
  }
```

Read receipts use `conversation_members.last_read_message_id` (one row per
member per conversation), not per-message receipts. Per-message
read-confirmation tracking is reserved for mandatory-read announcements
(Phase 3).

## F. Computer activity tracking (Phase 2)

```mermaid
erDiagram
  organizations ||--o{ tracking_policies : defines
  tracking_policies ||--o{ tracking_policy_assignments : "applies to"
  organizations ||--o{ monitoring_notices : publishes
  monitoring_notices ||--o{ notice_acknowledgements : "acknowledged by"
  members ||--o{ notice_acknowledgements : signs
  members ||--o{ activity_buckets : generates
  devices ||--o{ activity_buckets : "sampled on"
  app_catalog ||--o{ activity_buckets : identifies
  organizations ||--o{ category_rules : configures
  members ||--o{ idle_periods : resolves
  members ||--o{ screenshots : "captured for"
  devices ||--o{ device_integrity_events : reports
  members ||--o{ activity_daily : "rolled up"

  tracking_policies {
    uuid id PK
    uuid org_id FK
    text name
    bool enabled
    int idle_threshold_s "default 300"
    bool idle_prompt
    bool track_apps
    bool track_window_titles "default false"
    text track_urls "off | domain"
    bool track_input_intensity "default false"
    int screenshot_interval_min "null = off"
    bool screenshot_blur
    int employee_delete_grace_min
    jsonb retention_days "per data class"
    uuid notice_id FK "must be acknowledged before activation"
  }
  tracking_policy_assignments {
    uuid id PK
    uuid org_id FK
    uuid policy_id FK
    text scope_type
    uuid scope_id
  }
  monitoring_notices {
    uuid id PK
    uuid org_id FK
    int version
    jsonb body "{he, en} plain-language notice"
    jsonb data_collected "machine-readable list"
    timestamptz effective_at
  }
  notice_acknowledgements {
    uuid id PK
    uuid org_id FK
    uuid notice_id FK
    uuid member_id FK
    uuid device_id FK
    timestamptz acknowledged_at
    inet ip
  }
  app_catalog {
    uuid id PK
    text platform
    text identifier "bundle id or exe name"
    text display_name
    text default_category
  }
  category_rules {
    uuid id PK
    uuid org_id FK
    text scope_type "org | team | position"
    uuid scope_id
    text match_type "app | domain"
    text match_value
    text category "productive | neutral | unproductive"
  }
  activity_buckets {
    uuid id PK
    uuid org_id FK
    uuid member_id FK
    uuid device_id FK
    timestamptz bucket_start "1-minute, partition key"
    smallint active_s
    smallint idle_s
    uuid app_id FK
    text domain
    text window_title "only if policy allows"
    text category
    smallint input_intensity "counts bucketed 0-4, never content"
    uuid time_entry_id FK
    uuid job_code_id FK
  }
  activity_daily {
    uuid org_id FK
    uuid member_id PK
    date day PK
    int active_s
    int idle_s
    int focus_s "uninterrupted >= 25 min"
    int context_switches
    int meeting_s
    jsonb by_category
    jsonb top_apps
  }
  idle_periods {
    uuid id PK
    uuid org_id FK
    uuid member_id FK
    tstzrange during
    text resolution "offline_work | meeting | break | personal_excluded | discard"
    uuid job_code_id FK
    text note
  }
  screenshots {
    uuid id PK
    uuid org_id FK
    uuid member_id FK
    uuid device_id FK
    timestamptz captured_at
    smallint display_index
    text storage_path "encrypted bucket"
    bool blurred
    text status "grace | visible | deleted_by_employee | purged"
    timestamptz grace_until
  }
  device_integrity_events {
    uuid id PK
    uuid org_id FK
    uuid device_id FK
    text kind "agent_stopped | clock_tamper | permission_revoked | heartbeat_gap | uninstall"
    jsonb details
    timestamptz occurred_at
  }
```

**Unified timeline (read model).** `member_day_timeline` is a view (later a
table refreshed by the worker) that merges, per member per day:
scheduled `shifts`, `time_entries` and breaks from any source,
`activity_buckets` collapsed into contiguous segments, `idle_periods`,
and tasks/jobs (Phase 3). Every segment carries a `source` so the UI can
show _how_ each minute is known.

**Employee transparency.** Every manager read of screenshots or activity
detail writes an `audit_log` row. The employee's privacy dashboard shows
"who viewed my data, when".

## G. Later phases (outline)

| Phase                      | Tables                                                                                                                                                                                                                                         | Notes                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 3 · Tasks & jobs           | `task_lists`, `tasks`, `task_assignees`, `task_checklist_items`, `task_attachments`, `recurrence_rules`, `customers`, `sites` (geo), `jobs`, `job_visits`, `job_status_history`                                                                | Tasks use `recurrence_rules` (RRULE). Jobs link to `job_codes` for billing and to `time_entries`. |
| 3 · Forms                  | `forms`, `form_versions` (immutable JSON schema), `form_submissions`, `submission_files`, `form_workflows`, `escalations`                                                                                                                      | Submissions are pinned to a version; scoring and conditional logic live in the schema.            |
| 3 · Time off               | `time_off_types` (incl. sick, vacation, **reserve duty / מילואים**, bereavement), `time_off_policies` (accrual rules), `time_off_ledger` (accrual, usage, adjustment, carry-over), `time_off_requests` → `approval_requests`                   | Balance = `SUM(ledger)`; negative-balance limits enforced in the command.                         |
| 3 · Documents & onboarding | `document_types` (with expiry), `documents`, `document_requests`, `signatures` (evidence: hash, IP, timestamp), `onboarding_flows`, `onboarding_steps`, `onboarding_runs`                                                                      |                                                                                                   |
| 3 · Announcements          | `announcements`, `announcement_targets` (scope rules), `announcement_reads` (mandatory-read confirmations), `surveys`, `survey_questions`, `survey_responses` (anonymous mode stores no `member_id`), `events`, `event_rsvps`                  |                                                                                                   |
| 4 · AI                     | `ai_threads`, `ai_messages`, `ai_proposals` (commands, dry-run diff, status, applied_at, reverted_at), `ai_usage`, `ai_settings`                                                                                                               |                                                                                                   |
| 4 · Analytics              | `metric_definitions` (semantic layer), `reports`, `report_schedules`, `report_runs`                                                                                                                                                            |                                                                                                   |
| 4 · Learning & KB          | `kb_spaces`, `kb_articles`, `kb_chunks` (pgvector), `courses`, `course_versions`, `lessons`, `quizzes`, `enrollments`, `certifications` (expiry), `member_skills`                                                                              | `member_skills` also feeds the scheduler's skill constraints.                                     |
| 3–4 · HR extras            | `expenses`, `expense_receipts` (OCR fields), `recognitions`, `points_ledger`, `rewards`, `redemptions`, `tickets`, `ticket_messages`, `reviews`, `one_on_one_notes`                                                                            |                                                                                                   |
| 5 · Platform               | `partners`, `custom_domains`, `subscriptions`, `invoices`, `usage_snapshots` (seat counts), `integrations`, `integration_secrets` (Vault), `webhook_endpoints`, `webhook_deliveries`, `scim_tokens`, `sso_connections`, `calendar_connections` |                                                                                                   |

## H. Key RLS policies (sketch)

```sql
-- Org-wide settings tables (locations, positions, policies…)
create policy read  on locations for select using (is_org_member(org_id));
create policy write on locations for all
  using (has_org_perm(org_id, 'org.locations.manage'))
  with check (has_org_perm(org_id, 'org.locations.manage'));

-- People-scoped data (time_entries, shifts, timesheets…)
create policy read on time_entries for select using (
  member_id = any (my_member_ids())                         -- self
  or can_access_member(org_id, member_id, 'time.entries.read')
);

-- Append-only evidence: no UPDATE/DELETE policy exists at all.
create policy insert_own on time_events for insert with check (
  member_id = any (my_member_ids())
  or can_access_member(org_id, member_id, 'time.entries.edit')  -- manager punch
);
```

Every policy has a matching pgTAP test (`supabase/tests/rls/*.sql`).
