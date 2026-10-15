-- ============================================================
-- 001_foundation.sql — Ritmo Phase 1 schema
--
-- Tenancy model
--   Every tenant row carries org_id. Row-Level Security is enabled on
--   every table. The web server connects as `ritmo_app`
--   and runs each request inside a transaction that does
--     SET LOCAL ROLE ritmo_user;
--     set_config('request.jwt.claims', '{"sub": "<user id>"}', true);
--   so every query is filtered by the policies below. `ritmo_auth.uid()`
--   reads that claim, the same convention Supabase uses.
--
-- Everything lives in the private schemas `ritmo` and `ritmo_auth`.
-- Neither is exposed by Supabase's auto-generated REST API, and neither
-- collides with Supabase's own `auth` schema, so this file runs unchanged
-- on a local Postgres and on a Supabase project.
--
-- Composite foreign keys (org_id, id) make it impossible for a row to
-- reference another tenant's row, even if application code has a bug.
--
-- Roles inside an org: owner > admin > manager > employee.
--   Managers are scoped to the locations listed in member_locations.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ------------------------------------------------------------
-- Database roles
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ritmo_user') THEN
    CREATE ROLE ritmo_user NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ritmo_app') THEN
    CREATE ROLE ritmo_app LOGIN NOINHERIT;
  END IF;
END $$;
GRANT ritmo_user TO ritmo_app;

-- ------------------------------------------------------------
-- ritmo_auth schema: users, sessions, login throttling.
-- Only ritmo_app (the server) touches these directly; the
-- `ritmo_user` role cannot read password hashes or sessions.
-- ------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS ritmo_auth;
CREATE SCHEMA IF NOT EXISTS ritmo;

CREATE OR REPLACE FUNCTION ritmo_auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')::uuid
$$;

CREATE TABLE ritmo_auth.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stored lowercase so uniqueness is case-insensitive.
  email         text NOT NULL UNIQUE CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+$'),
  password_hash text,
  full_name     text NOT NULL,
  locale        text NOT NULL DEFAULT 'he' CHECK (locale IN ('he', 'en')),
  theme         text NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ritmo_auth.sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES ritmo_auth.users(id) ON DELETE CASCADE,
  token_hash   bytea NOT NULL UNIQUE,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON ritmo_auth.sessions(user_id);

-- Login throttling: failed attempts per email in a rolling window.
CREATE TABLE ritmo_auth.login_attempts (
  id         bigserial PRIMARY KEY,
  email      text NOT NULL,
  succeeded  boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_email_idx ON ritmo_auth.login_attempts(email, created_at DESC);

-- ------------------------------------------------------------
-- Generic updated_at trigger
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION ritmo.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- ------------------------------------------------------------
-- Organizations and structure
-- ------------------------------------------------------------
CREATE TABLE ritmo.organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  slug       text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,48}$'),
  locale     text NOT NULL DEFAULT 'he' CHECK (locale IN ('he', 'en')),
  timezone   text NOT NULL DEFAULT 'Asia/Jerusalem',
  currency   char(3) NOT NULL DEFAULT 'ILS',
  -- Attendance policy, validated in @ritmo/core (zod). Defaults to the
  -- Israeli preset; must be reviewed by labor counsel before launch.
  attendance_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER organizations_touch BEFORE UPDATE ON ritmo.organizations
  FOR EACH ROW EXECUTE FUNCTION ritmo.touch_updated_at();

CREATE TABLE ritmo.locations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES ritmo.organizations(id) ON DELETE CASCADE,
  name               text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  kind               text NOT NULL DEFAULT 'branch' CHECK (kind IN ('branch', 'office')),
  address            text,
  lat                double precision CHECK (lat BETWEEN -90 AND 90),
  lng                double precision CHECK (lng BETWEEN -180 AND 180),
  geofence_radius_m  integer NOT NULL DEFAULT 150 CHECK (geofence_radius_m BETWEEN 25 AND 5000),
  weekly_budget_minor bigint CHECK (weekly_budget_minor >= 0),
  sort_order         integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id)
);

CREATE TABLE ritmo.positions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES ritmo.organizations(id) ON DELETE CASCADE,
  name              text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  -- Schedule tint, from the brand palette (shift-green … shift-stone).
  color             text NOT NULL DEFAULT 'stone' CHECK (color IN ('green', 'sun', 'sky', 'clay', 'stone')),
  sort_order        integer NOT NULL DEFAULT 0,
  UNIQUE (org_id, id),
  UNIQUE (org_id, name)
);

CREATE TABLE ritmo.members (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES ritmo.organizations(id) ON DELETE CASCADE,
  -- Nullable: a person can exist (and be scheduled) before accepting an invite.
  user_id             uuid REFERENCES ritmo_auth.users(id) ON DELETE SET NULL,
  first_name          text NOT NULL CHECK (length(first_name) BETWEEN 1 AND 60),
  last_name           text NOT NULL DEFAULT '' CHECK (length(last_name) <= 60),
  email               text CHECK (email = lower(email)),
  phone               text CHECK (phone ~ '^\+?[0-9 -]{6,20}$'),
  employee_no         text,
  role                text NOT NULL DEFAULT 'employee' CHECK (role IN ('owner', 'admin', 'manager', 'employee')),
  title               text,
  position_id         uuid,
  primary_location_id uuid,
  works_on            text NOT NULL DEFAULT 'site' CHECK (works_on IN ('site', 'computer', 'both')),
  contract_hours_week numeric(5, 2) CHECK (contract_hours_week BETWEEN 0 AND 80),
  avatar_color        text NOT NULL DEFAULT 'stone' CHECK (avatar_color IN ('green', 'sun', 'sky', 'clay', 'stone')),
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'inactive')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  UNIQUE (org_id, user_id),
  UNIQUE (org_id, email),
  FOREIGN KEY (org_id, position_id) REFERENCES ritmo.positions(org_id, id),
  FOREIGN KEY (org_id, primary_location_id) REFERENCES ritmo.locations(org_id, id)
);
CREATE INDEX members_user_idx ON ritmo.members(user_id);
CREATE TRIGGER members_touch BEFORE UPDATE ON ritmo.members
  FOR EACH ROW EXECUTE FUNCTION ritmo.touch_updated_at();

-- Where a person works. For managers this is also their scope.
CREATE TABLE ritmo.member_locations (
  org_id      uuid NOT NULL,
  member_id   uuid NOT NULL,
  location_id uuid NOT NULL,
  PRIMARY KEY (member_id, location_id),
  FOREIGN KEY (org_id, member_id) REFERENCES ritmo.members(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, location_id) REFERENCES ritmo.locations(org_id, id) ON DELETE CASCADE
);
CREATE INDEX member_locations_location_idx ON ritmo.member_locations(location_id);

-- Pay rates are restricted: separate table, stricter policy.
CREATE TABLE ritmo.member_pay (
  org_id            uuid NOT NULL,
  member_id         uuid PRIMARY KEY,
  hourly_rate_minor bigint NOT NULL CHECK (hourly_rate_minor >= 0),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, member_id) REFERENCES ritmo.members(org_id, id) ON DELETE CASCADE
);

CREATE TABLE ritmo.invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  member_id   uuid NOT NULL,
  token_hash  bytea NOT NULL UNIQUE,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '14 days',
  accepted_at timestamptz,
  FOREIGN KEY (org_id, member_id) REFERENCES ritmo.members(org_id, id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Scheduling
-- ------------------------------------------------------------
CREATE TABLE ritmo.shifts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL,
  location_id       uuid NOT NULL,
  position_id       uuid,
  member_id         uuid, -- null = open shift
  starts_at         timestamptz NOT NULL,
  ends_at           timestamptz NOT NULL,
  break_minutes     integer NOT NULL DEFAULT 0 CHECK (break_minutes BETWEEN 0 AND 240),
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  open_bonus_minor  bigint CHECK (open_bonus_minor >= 0),
  notes             text CHECK (length(notes) <= 500),
  created_by        uuid,
  published_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  CHECK (ends_at > starts_at AND ends_at - starts_at <= interval '16 hours'),
  FOREIGN KEY (org_id, location_id) REFERENCES ritmo.locations(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, position_id) REFERENCES ritmo.positions(org_id, id),
  FOREIGN KEY (org_id, member_id) REFERENCES ritmo.members(org_id, id) ON DELETE SET NULL (member_id),
  -- One person can't be in two places at once.
  EXCLUDE USING gist (member_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE (member_id IS NOT NULL)
);
CREATE INDEX shifts_org_time_idx ON ritmo.shifts(org_id, starts_at);
CREATE INDEX shifts_member_idx ON ritmo.shifts(member_id, starts_at);
CREATE TRIGGER shifts_touch BEFORE UPDATE ON ritmo.shifts
  FOR EACH ROW EXECUTE FUNCTION ritmo.touch_updated_at();

CREATE TABLE ritmo.shift_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL,
  kind                text NOT NULL CHECK (kind IN ('swap', 'claim', 'drop')),
  shift_id            uuid NOT NULL,
  requester_member_id uuid NOT NULL,
  target_member_id    uuid, -- swap: the colleague taking the shift
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  note                text CHECK (length(note) <= 300),
  decided_by          uuid,
  decided_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, shift_id) REFERENCES ritmo.shifts(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, requester_member_id) REFERENCES ritmo.members(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, target_member_id) REFERENCES ritmo.members(org_id, id) ON DELETE CASCADE,
  CHECK ((kind = 'swap') = (target_member_id IS NOT NULL))
);
-- Only one pending request per shift and requester.
CREATE UNIQUE INDEX shift_requests_one_pending
  ON ritmo.shift_requests(shift_id, requester_member_id) WHERE status = 'pending';

-- ------------------------------------------------------------
-- Time & attendance
-- ------------------------------------------------------------
-- Append-only evidence. No UPDATE or DELETE policy exists.
CREATE TABLE ritmo.time_events (
  id              uuid PRIMARY KEY, -- generated by the client, so retries are idempotent
  org_id          uuid NOT NULL,
  member_id       uuid NOT NULL,
  type            text NOT NULL CHECK (type IN ('clock_in', 'clock_out', 'break_start', 'break_end')),
  occurred_at     timestamptz NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now(),
  source          text NOT NULL CHECK (source IN ('web', 'mobile', 'kiosk', 'desktop', 'manager')),
  location_id     uuid,
  lat             double precision,
  lng             double precision,
  accuracy_m      real,
  distance_m      integer,
  inside_geofence boolean,
  recorded_by     uuid, -- member who recorded it (manager punches)
  note            text CHECK (length(note) <= 300),
  FOREIGN KEY (org_id, member_id) REFERENCES ritmo.members(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, location_id) REFERENCES ritmo.locations(org_id, id)
);
CREATE INDEX time_events_member_idx ON ritmo.time_events(member_id, occurred_at DESC);

-- Payroll-relevant intervals derived from events. Manager edits change
-- the entry (with a reason), never the event.
CREATE TABLE ritmo.time_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL,
  member_id        uuid NOT NULL,
  location_id      uuid,
  shift_id         uuid,
  work_date        date NOT NULL,
  started_at       timestamptz NOT NULL,
  ended_at         timestamptz,
  break_minutes    integer NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  break_started_at timestamptz,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  edited_reason    text CHECK (length(edited_reason) <= 300),
  edited_by        uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  CHECK (ended_at IS NULL OR ended_at > started_at),
  CHECK ((status = 'open') = (ended_at IS NULL)),
  FOREIGN KEY (org_id, member_id) REFERENCES ritmo.members(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, location_id) REFERENCES ritmo.locations(org_id, id),
  FOREIGN KEY (org_id, shift_id) REFERENCES ritmo.shifts(org_id, id) ON DELETE SET NULL (shift_id)
);
-- At most one open entry per person.
CREATE UNIQUE INDEX time_entries_one_open ON ritmo.time_entries(member_id) WHERE ended_at IS NULL;
CREATE INDEX time_entries_member_date_idx ON ritmo.time_entries(member_id, work_date);
CREATE INDEX time_entries_org_date_idx ON ritmo.time_entries(org_id, work_date);
CREATE TRIGGER time_entries_touch BEFORE UPDATE ON ritmo.time_entries
  FOR EACH ROW EXECUTE FUNCTION ritmo.touch_updated_at();

CREATE TABLE ritmo.timesheet_approvals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  member_id   uuid NOT NULL,
  week_start  date NOT NULL CHECK (extract(dow FROM week_start) = 0), -- Israeli week starts Sunday
  status      text NOT NULL CHECK (status IN ('approved', 'rejected')),
  totals      jsonb NOT NULL,
  comment     text CHECK (length(comment) <= 300),
  decided_by  uuid NOT NULL,
  decided_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, member_id, week_start),
  FOREIGN KEY (org_id, member_id) REFERENCES ritmo.members(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, decided_by) REFERENCES ritmo.members(org_id, id),
  CHECK (decided_by <> member_id) -- nobody approves their own hours
);

CREATE TABLE ritmo.anomalies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL,
  member_id     uuid NOT NULL,
  time_entry_id uuid,
  kind          text NOT NULL CHECK (kind IN ('late', 'out_of_geofence', 'long_shift', 'missing_break', 'no_clock_out')),
  details       jsonb NOT NULL DEFAULT '{}'::jsonb,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_by   uuid,
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, member_id) REFERENCES ritmo.members(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, time_entry_id) REFERENCES ritmo.time_entries(org_id, id) ON DELETE CASCADE
);
CREATE INDEX anomalies_open_idx ON ritmo.anomalies(org_id) WHERE status = 'open';

-- ------------------------------------------------------------
-- Computer activity (desktop agent uploads aggregates, never content)
-- ------------------------------------------------------------
CREATE TABLE ritmo.activity_segments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL,
  member_id  uuid NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at   timestamptz NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('focus', 'neutral', 'idle', 'break')),
  app        text CHECK (length(app) <= 80), -- app name or domain only
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at > started_at),
  FOREIGN KEY (org_id, member_id) REFERENCES ritmo.members(org_id, id) ON DELETE CASCADE
);
CREATE INDEX activity_member_time_idx ON ritmo.activity_segments(member_id, started_at);

-- ------------------------------------------------------------
-- Chat
-- ------------------------------------------------------------
CREATE TABLE ritmo.conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES ritmo.organizations(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('channel', 'dm')),
  name            text CHECK (length(name) <= 80),
  location_id     uuid,
  created_by      uuid,
  last_message_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  CHECK ((kind = 'channel') = (name IS NOT NULL)),
  FOREIGN KEY (org_id, location_id) REFERENCES ritmo.locations(org_id, id) ON DELETE CASCADE
);

CREATE TABLE ritmo.conversation_members (
  org_id          uuid NOT NULL,
  conversation_id uuid NOT NULL,
  member_id       uuid NOT NULL,
  last_read_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, member_id),
  FOREIGN KEY (org_id, conversation_id) REFERENCES ritmo.conversations(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, member_id) REFERENCES ritmo.members(org_id, id) ON DELETE CASCADE
);
CREATE INDEX conversation_members_member_idx ON ritmo.conversation_members(member_id);

CREATE TABLE ritmo.messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL,
  conversation_id  uuid NOT NULL,
  sender_member_id uuid NOT NULL,
  body             text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, conversation_id) REFERENCES ritmo.conversations(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, sender_member_id) REFERENCES ritmo.members(org_id, id) ON DELETE CASCADE
);
CREATE INDEX messages_conversation_idx ON ritmo.messages(conversation_id, created_at DESC);

-- ------------------------------------------------------------
-- Audit log: append-only, written through ritmo.audit() only.
-- ------------------------------------------------------------
CREATE TABLE ritmo.audit_log (
  id              bigserial PRIMARY KEY,
  org_id          uuid NOT NULL REFERENCES ritmo.organizations(id) ON DELETE CASCADE,
  actor_user_id   uuid,
  actor_member_id uuid,
  action          text NOT NULL,
  target_type     text,
  target_id       uuid,
  details         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_org_idx ON ritmo.audit_log(org_id, created_at DESC);

-- ============================================================
-- Authorization helpers. SECURITY DEFINER so policies can consult
-- membership without recursing into the members policy. All are
-- STABLE and pin search_path.
-- ============================================================
CREATE OR REPLACE FUNCTION ritmo.my_member_id(p_org uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ritmo, pg_temp AS $$
  SELECT id FROM ritmo.members
  WHERE org_id = p_org AND user_id = ritmo_auth.uid() AND status = 'active'
$$;

CREATE OR REPLACE FUNCTION ritmo.my_role(p_org uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ritmo, pg_temp AS $$
  SELECT role FROM ritmo.members
  WHERE org_id = p_org AND user_id = ritmo_auth.uid() AND status = 'active'
$$;

CREATE OR REPLACE FUNCTION ritmo.is_member(p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ritmo, pg_temp AS $$
  SELECT ritmo.my_member_id(p_org) IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION ritmo.is_admin(p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ritmo, pg_temp AS $$
  SELECT coalesce(ritmo.my_role(p_org) IN ('owner', 'admin'), false)
$$;

-- Owner/admin: every location. Manager: the locations they're assigned to.
CREATE OR REPLACE FUNCTION ritmo.can_manage_location(p_org uuid, p_location uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ritmo, pg_temp AS $$
  SELECT CASE ritmo.my_role(p_org)
    WHEN 'owner' THEN true
    WHEN 'admin' THEN true
    WHEN 'manager' THEN EXISTS (
      SELECT 1 FROM ritmo.member_locations ml
      WHERE ml.member_id = ritmo.my_member_id(p_org) AND ml.location_id = p_location)
    ELSE false
  END
$$;

-- Owner/admin: anyone. Manager: people who share one of their locations
-- (never owners or admins). Nobody "manages" themselves through this path.
CREATE OR REPLACE FUNCTION ritmo.can_manage_member(p_org uuid, p_member uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ritmo, pg_temp AS $$
  SELECT CASE ritmo.my_role(p_org)
    WHEN 'owner' THEN true
    WHEN 'admin' THEN true
    WHEN 'manager' THEN EXISTS (
      SELECT 1
      FROM ritmo.members target
      JOIN ritmo.member_locations tl ON tl.member_id = target.id
      JOIN ritmo.member_locations ml ON ml.location_id = tl.location_id
      WHERE target.id = p_member AND target.org_id = p_org
        AND target.role IN ('manager', 'employee')
        AND ml.member_id = ritmo.my_member_id(p_org))
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION ritmo.is_conversation_member(p_conversation uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ritmo, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM ritmo.conversation_members cm
    JOIN ritmo.members m ON m.id = cm.member_id
    WHERE cm.conversation_id = p_conversation AND m.user_id = ritmo_auth.uid() AND m.status = 'active')
$$;

-- Audit writer: the only way rows get into audit_log.
CREATE OR REPLACE FUNCTION ritmo.audit(
  p_org uuid, p_action text, p_target_type text, p_target_id uuid, p_details jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ritmo, pg_temp AS $$
BEGIN
  IF NOT ritmo.is_member(p_org) THEN
    RAISE EXCEPTION 'not a member of this organization' USING ERRCODE = '42501';
  END IF;
  INSERT INTO ritmo.audit_log (org_id, actor_user_id, actor_member_id, action, target_type, target_id, details)
  VALUES (p_org, ritmo_auth.uid(), ritmo.my_member_id(p_org), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb));
END $$;

-- ============================================================
-- Guard rails enforced in triggers (independent of the app)
-- ============================================================

-- Role changes: only owners/admins may grant manager+, only owners may
-- grant owner/admin, and nobody changes their own role.
CREATE OR REPLACE FUNCTION ritmo.guard_member_role() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ritmo, pg_temp AS $$
DECLARE
  actor_role text := ritmo.my_role(NEW.org_id);
BEGIN
  -- Seeds and migrations run without a user; trust them.
  IF ritmo_auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND NEW.role IS NOT DISTINCT FROM OLD.role THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND OLD.user_id = ritmo_auth.uid() THEN
    RAISE EXCEPTION 'you cannot change your own role' USING ERRCODE = '42501';
  END IF;
  IF NEW.role IN ('owner', 'admin') AND actor_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'only the owner can grant owner or admin' USING ERRCODE = '42501';
  END IF;
  IF NEW.role = 'manager' AND actor_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'only owners and admins can grant manager' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER members_guard_role BEFORE INSERT OR UPDATE OF role ON ritmo.members
  FOR EACH ROW EXECUTE FUNCTION ritmo.guard_member_role();

-- Employees may only close/break their own open entry; edits to the
-- start time or to closed entries require a manager and a reason.
CREATE OR REPLACE FUNCTION ritmo.guard_time_entry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ritmo, pg_temp AS $$
BEGIN
  IF ritmo_auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF ritmo.can_manage_member(NEW.org_id, NEW.member_id) THEN
    IF TG_OP = 'UPDATE' AND (NEW.started_at <> OLD.started_at OR OLD.status = 'closed')
       AND coalesce(NEW.edited_reason, '') = '' THEN
      RAISE EXCEPTION 'edits to recorded time need a reason' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  -- Self-service path
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'closed' OR NEW.started_at <> OLD.started_at THEN
      RAISE EXCEPTION 'only a manager can change recorded time' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER time_entries_guard BEFORE INSERT OR UPDATE ON ritmo.time_entries
  FOR EACH ROW EXECUTE FUNCTION ritmo.guard_time_entry();

-- ============================================================
-- Chat bookkeeping
-- ============================================================
CREATE OR REPLACE FUNCTION ritmo.bump_conversation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ritmo, pg_temp AS $$
BEGIN
  UPDATE ritmo.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;
CREATE TRIGGER messages_bump AFTER INSERT ON ritmo.messages
  FOR EACH ROW EXECUTE FUNCTION ritmo.bump_conversation();

-- ============================================================
-- Row-Level Security
-- ============================================================
ALTER TABLE ritmo.organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.locations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.positions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.members              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.member_locations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.member_pay           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.invitations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.shifts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.shift_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.time_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.time_entries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.timesheet_approvals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.anomalies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.activity_segments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.audit_log            ENABLE ROW LEVEL SECURITY;

-- organizations
CREATE POLICY org_read ON ritmo.organizations FOR SELECT USING (ritmo.is_member(id));
CREATE POLICY org_update ON ritmo.organizations FOR UPDATE
  USING (ritmo.is_admin(id)) WITH CHECK (ritmo.is_admin(id));

-- locations, positions: everyone in the org reads; owners/admins write
CREATE POLICY loc_read ON ritmo.locations FOR SELECT USING (ritmo.is_member(org_id));
CREATE POLICY loc_write ON ritmo.locations FOR ALL
  USING (ritmo.is_admin(org_id)) WITH CHECK (ritmo.is_admin(org_id));
CREATE POLICY pos_read ON ritmo.positions FOR SELECT USING (ritmo.is_member(org_id));
CREATE POLICY pos_write ON ritmo.positions FOR ALL
  USING (ritmo.is_admin(org_id)) WITH CHECK (ritmo.is_admin(org_id));

-- members: the directory is visible to the whole org (like a staff list);
-- managers add/edit people in their locations, admins everyone.
CREATE POLICY members_read ON ritmo.members FOR SELECT USING (ritmo.is_member(org_id));
CREATE POLICY members_insert ON ritmo.members FOR INSERT WITH CHECK (
  ritmo.is_admin(org_id)
  OR (ritmo.my_role(org_id) = 'manager' AND role = 'employee'
      AND ritmo.can_manage_location(org_id, primary_location_id)));
CREATE POLICY members_update ON ritmo.members FOR UPDATE
  USING (ritmo.can_manage_member(org_id, id) OR user_id = ritmo_auth.uid())
  WITH CHECK (ritmo.can_manage_member(org_id, id) OR user_id = ritmo_auth.uid());
CREATE POLICY members_delete ON ritmo.members FOR DELETE USING (ritmo.is_admin(org_id) AND role <> 'owner');

CREATE POLICY ml_read ON ritmo.member_locations FOR SELECT USING (ritmo.is_member(org_id));
CREATE POLICY ml_write ON ritmo.member_locations FOR ALL
  USING (ritmo.is_admin(org_id) OR (ritmo.can_manage_member(org_id, member_id) AND ritmo.can_manage_location(org_id, location_id)))
  WITH CHECK (ritmo.is_admin(org_id) OR (ritmo.can_manage_location(org_id, location_id)
    AND EXISTS (SELECT 1 FROM ritmo.members m WHERE m.id = member_id AND m.role = 'employee')));

-- pay: yourself, or someone who manages you
CREATE POLICY pay_read ON ritmo.member_pay FOR SELECT
  USING (member_id = ritmo.my_member_id(org_id) OR ritmo.can_manage_member(org_id, member_id));
CREATE POLICY pay_write ON ritmo.member_pay FOR ALL
  USING (ritmo.can_manage_member(org_id, member_id))
  WITH CHECK (ritmo.can_manage_member(org_id, member_id));

CREATE POLICY inv_read ON ritmo.invitations FOR SELECT USING (ritmo.can_manage_member(org_id, member_id));
CREATE POLICY inv_write ON ritmo.invitations FOR INSERT WITH CHECK (ritmo.can_manage_member(org_id, member_id));

-- shifts: drafts are visible only to whoever can edit that location
CREATE POLICY shifts_read ON ritmo.shifts FOR SELECT USING (
  ritmo.is_member(org_id) AND (status = 'published' OR ritmo.can_manage_location(org_id, location_id)));
CREATE POLICY shifts_write ON ritmo.shifts FOR ALL
  USING (ritmo.can_manage_location(org_id, location_id))
  WITH CHECK (ritmo.can_manage_location(org_id, location_id));

-- shift requests
CREATE POLICY sr_read ON ritmo.shift_requests FOR SELECT USING (
  requester_member_id = ritmo.my_member_id(org_id)
  OR target_member_id = ritmo.my_member_id(org_id)
  OR EXISTS (SELECT 1 FROM ritmo.shifts s WHERE s.id = shift_id AND ritmo.can_manage_location(s.org_id, s.location_id)));
CREATE POLICY sr_insert ON ritmo.shift_requests FOR INSERT WITH CHECK (
  requester_member_id = ritmo.my_member_id(org_id) AND status = 'pending'
  AND EXISTS (
    SELECT 1 FROM ritmo.shifts s WHERE s.id = shift_id AND s.status = 'published' AND s.starts_at > now()
      AND ((kind IN ('swap', 'drop') AND s.member_id = requester_member_id)
        OR (kind = 'claim' AND s.member_id IS NULL))));
CREATE POLICY sr_update ON ritmo.shift_requests FOR UPDATE USING (
  requester_member_id = ritmo.my_member_id(org_id)
  OR EXISTS (SELECT 1 FROM ritmo.shifts s WHERE s.id = shift_id AND ritmo.can_manage_location(s.org_id, s.location_id)))
  WITH CHECK (
  (requester_member_id = ritmo.my_member_id(org_id) AND status IN ('pending', 'cancelled'))
  OR EXISTS (SELECT 1 FROM ritmo.shifts s WHERE s.id = shift_id AND ritmo.can_manage_location(s.org_id, s.location_id)));

-- time events: append-only (INSERT + SELECT, nothing else)
CREATE POLICY te_read ON ritmo.time_events FOR SELECT USING (
  member_id = ritmo.my_member_id(org_id) OR ritmo.can_manage_member(org_id, member_id));
CREATE POLICY te_insert ON ritmo.time_events FOR INSERT WITH CHECK (
  (member_id = ritmo.my_member_id(org_id) AND source <> 'manager')
  OR (ritmo.can_manage_member(org_id, member_id) AND source = 'manager'));

CREATE POLICY entries_read ON ritmo.time_entries FOR SELECT USING (
  member_id = ritmo.my_member_id(org_id) OR ritmo.can_manage_member(org_id, member_id));
CREATE POLICY entries_insert ON ritmo.time_entries FOR INSERT WITH CHECK (
  member_id = ritmo.my_member_id(org_id) OR ritmo.can_manage_member(org_id, member_id));
CREATE POLICY entries_update ON ritmo.time_entries FOR UPDATE
  USING (member_id = ritmo.my_member_id(org_id) OR ritmo.can_manage_member(org_id, member_id))
  WITH CHECK (member_id = ritmo.my_member_id(org_id) OR ritmo.can_manage_member(org_id, member_id));

CREATE POLICY tsa_read ON ritmo.timesheet_approvals FOR SELECT USING (
  member_id = ritmo.my_member_id(org_id) OR ritmo.can_manage_member(org_id, member_id));
CREATE POLICY tsa_write ON ritmo.timesheet_approvals FOR ALL
  USING (ritmo.can_manage_member(org_id, member_id))
  WITH CHECK (ritmo.can_manage_member(org_id, member_id) AND decided_by = ritmo.my_member_id(org_id));

CREATE POLICY anomalies_read ON ritmo.anomalies FOR SELECT USING (
  member_id = ritmo.my_member_id(org_id) OR ritmo.can_manage_member(org_id, member_id));
CREATE POLICY anomalies_insert ON ritmo.anomalies FOR INSERT WITH CHECK (
  member_id = ritmo.my_member_id(org_id) OR ritmo.can_manage_member(org_id, member_id));
CREATE POLICY anomalies_update ON ritmo.anomalies FOR UPDATE
  USING (ritmo.can_manage_member(org_id, member_id))
  WITH CHECK (ritmo.can_manage_member(org_id, member_id));

-- activity: the employee always sees exactly what their manager sees
CREATE POLICY activity_read ON ritmo.activity_segments FOR SELECT USING (
  member_id = ritmo.my_member_id(org_id) OR ritmo.can_manage_member(org_id, member_id));
CREATE POLICY activity_insert ON ritmo.activity_segments FOR INSERT WITH CHECK (
  member_id = ritmo.my_member_id(org_id));

-- chat
CREATE POLICY conv_read ON ritmo.conversations FOR SELECT USING (ritmo.is_conversation_member(id));
CREATE POLICY conv_insert ON ritmo.conversations FOR INSERT WITH CHECK (
  ritmo.is_member(org_id) AND created_by = ritmo.my_member_id(org_id)
  AND (kind = 'dm' OR ritmo.my_role(org_id) IN ('owner', 'admin', 'manager')));
CREATE POLICY cm_read ON ritmo.conversation_members FOR SELECT USING (ritmo.is_conversation_member(conversation_id));
CREATE POLICY cm_insert ON ritmo.conversation_members FOR INSERT WITH CHECK (
  ritmo.is_member(org_id) AND EXISTS (
    SELECT 1 FROM ritmo.conversations c
    WHERE c.id = conversation_id AND c.created_by = ritmo.my_member_id(c.org_id)));
CREATE POLICY cm_update_own ON ritmo.conversation_members FOR UPDATE
  USING (member_id = ritmo.my_member_id(org_id)) WITH CHECK (member_id = ritmo.my_member_id(org_id));
CREATE POLICY msg_read ON ritmo.messages FOR SELECT USING (ritmo.is_conversation_member(conversation_id));
CREATE POLICY msg_insert ON ritmo.messages FOR INSERT WITH CHECK (
  ritmo.is_conversation_member(conversation_id) AND sender_member_id = ritmo.my_member_id(org_id));

CREATE POLICY audit_read ON ritmo.audit_log FOR SELECT USING (ritmo.is_admin(org_id));

-- ============================================================
-- Organization creation (self-serve signup). A brand-new user isn't
-- a member of anything yet, so this one step runs as definer.
-- ============================================================
CREATE OR REPLACE FUNCTION ritmo.create_organization(
  p_name text, p_slug text, p_first_name text, p_last_name text, p_locale text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ritmo, pg_temp AS $$
DECLARE
  v_org uuid;
  v_member uuid;
  v_email text;
BEGIN
  IF ritmo_auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in first' USING ERRCODE = '42501';
  END IF;
  SELECT email INTO v_email FROM ritmo_auth.users WHERE id = ritmo_auth.uid();
  INSERT INTO ritmo.organizations (name, slug, locale) VALUES (p_name, p_slug, coalesce(p_locale, 'he'))
    RETURNING id INTO v_org;
  INSERT INTO ritmo.members (org_id, user_id, first_name, last_name, email, role, status, avatar_color)
    VALUES (v_org, ritmo_auth.uid(), p_first_name, coalesce(p_last_name, ''), v_email, 'owner', 'active', 'green')
    RETURNING id INTO v_member;
  INSERT INTO ritmo.audit_log (org_id, actor_user_id, actor_member_id, action, target_type, target_id)
    VALUES (v_org, ritmo_auth.uid(), v_member, 'organization.create', 'organization', v_org);
  RETURN v_org;
END $$;

-- Start (or reuse) a direct conversation between me and another member.
CREATE OR REPLACE FUNCTION ritmo.open_dm(p_org uuid, p_other uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ritmo, pg_temp AS $$
DECLARE
  v_me uuid := ritmo.my_member_id(p_org);
  v_conv uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not a member' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM ritmo.members WHERE id = p_other AND org_id = p_org AND status = 'active') THEN
    RAISE EXCEPTION 'unknown colleague' USING ERRCODE = '22023';
  END IF;
  IF v_me = p_other THEN RAISE EXCEPTION 'cannot message yourself' USING ERRCODE = '22023'; END IF;
  SELECT c.id INTO v_conv FROM ritmo.conversations c
    WHERE c.org_id = p_org AND c.kind = 'dm'
      AND EXISTS (SELECT 1 FROM ritmo.conversation_members WHERE conversation_id = c.id AND member_id = v_me)
      AND EXISTS (SELECT 1 FROM ritmo.conversation_members WHERE conversation_id = c.id AND member_id = p_other)
    LIMIT 1;
  IF v_conv IS NOT NULL THEN RETURN v_conv; END IF;
  INSERT INTO ritmo.conversations (org_id, kind, created_by) VALUES (p_org, 'dm', v_me) RETURNING id INTO v_conv;
  INSERT INTO ritmo.conversation_members (org_id, conversation_id, member_id)
    VALUES (p_org, v_conv, v_me), (p_org, v_conv, p_other);
  RETURN v_conv;
END $$;

-- Approve or reject a shift request atomically (applies the change).
CREATE OR REPLACE FUNCTION ritmo.decide_shift_request(p_request uuid, p_approve boolean) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ritmo, pg_temp AS $$
DECLARE
  r ritmo.shift_requests;
  s ritmo.shifts;
BEGIN
  SELECT * INTO r FROM ritmo.shift_requests WHERE id = p_request FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' THEN
    RAISE EXCEPTION 'request is no longer pending' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO s FROM ritmo.shifts WHERE id = r.shift_id FOR UPDATE;
  IF NOT ritmo.can_manage_location(s.org_id, s.location_id) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_approve THEN
    IF r.kind = 'swap' THEN
      UPDATE ritmo.shifts SET member_id = r.target_member_id WHERE id = s.id;
    ELSIF r.kind = 'claim' THEN
      IF s.member_id IS NOT NULL THEN
        RAISE EXCEPTION 'shift was already taken' USING ERRCODE = '22023';
      END IF;
      UPDATE ritmo.shifts SET member_id = r.requester_member_id WHERE id = s.id;
      UPDATE ritmo.shift_requests SET status = 'rejected', decided_by = ritmo.my_member_id(s.org_id), decided_at = now()
        WHERE shift_id = s.id AND id <> r.id AND status = 'pending';
    ELSE
      UPDATE ritmo.shifts SET member_id = NULL WHERE id = s.id;
    END IF;
  END IF;
  UPDATE ritmo.shift_requests
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        decided_by = ritmo.my_member_id(s.org_id), decided_at = now()
    WHERE id = r.id;
  PERFORM ritmo.audit(s.org_id, CASE WHEN p_approve THEN 'shift_request.approve' ELSE 'shift_request.reject' END,
    'shift_request', r.id, jsonb_build_object('kind', r.kind, 'shift_id', s.id));
END $$;

-- ============================================================
-- Invitations: look up and accept by token hash. The raw token only
-- ever exists in the invite link; the database stores its SHA-256.
-- ============================================================
CREATE OR REPLACE FUNCTION ritmo.invitation_preview(p_token_hash bytea)
RETURNS TABLE (org_name text, first_name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ritmo, pg_temp AS $$
  SELECT o.name, m.first_name, m.email
  FROM ritmo.invitations i
  JOIN ritmo.members m ON m.id = i.member_id
  JOIN ritmo.organizations o ON o.id = i.org_id
  WHERE i.token_hash = p_token_hash AND i.accepted_at IS NULL AND i.expires_at > now()
$$;

CREATE OR REPLACE FUNCTION ritmo.accept_invitation(p_token_hash bytea, p_user uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ritmo, pg_temp AS $$
DECLARE
  v_inv ritmo.invitations;
BEGIN
  SELECT * INTO v_inv FROM ritmo.invitations
    WHERE token_hash = p_token_hash AND accepted_at IS NULL AND expires_at > now()
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation is invalid or expired' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM ritmo.members WHERE org_id = v_inv.org_id AND user_id = p_user) THEN
    RAISE EXCEPTION 'already a member of this organization' USING ERRCODE = '23505';
  END IF;
  UPDATE ritmo.members SET user_id = p_user, status = 'active' WHERE id = v_inv.member_id;
  UPDATE ritmo.invitations SET accepted_at = now() WHERE id = v_inv.id;
  INSERT INTO ritmo.audit_log (org_id, actor_user_id, actor_member_id, action, target_type, target_id)
    VALUES (v_inv.org_id, p_user, v_inv.member_id, 'invitation.accept', 'member', v_inv.member_id);
  RETURN v_inv.org_id;
END $$;

-- ============================================================
-- Grants. `ritmo_user` gets table privileges; RLS narrows rows.
-- No UPDATE/DELETE on time_events or audit_log for anyone.
-- ============================================================
GRANT USAGE ON SCHEMA ritmo TO ritmo_user, ritmo_app;
GRANT USAGE ON SCHEMA ritmo_auth TO ritmo_user, ritmo_app;
GRANT EXECUTE ON FUNCTION ritmo_auth.uid() TO ritmo_user, ritmo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  ritmo.organizations, ritmo.locations, ritmo.positions, ritmo.members, ritmo.member_locations,
  ritmo.member_pay, ritmo.shifts, ritmo.shift_requests, ritmo.time_entries, ritmo.timesheet_approvals,
  ritmo.anomalies, ritmo.conversations, ritmo.conversation_members, ritmo.messages
  TO ritmo_user;
GRANT SELECT, INSERT ON ritmo.time_events, ritmo.activity_segments, ritmo.invitations TO ritmo_user;
GRANT SELECT ON ritmo.audit_log TO ritmo_user;
REVOKE ALL ON ritmo.audit_log FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ritmo TO ritmo_user;
REVOKE ALL ON SCHEMA ritmo, ritmo_auth FROM PUBLIC;

-- The server reads auth tables directly (login, sessions, invites).
GRANT SELECT, INSERT, UPDATE, DELETE ON ritmo_auth.users, ritmo_auth.sessions, ritmo_auth.login_attempts TO ritmo_app;
GRANT USAGE ON SEQUENCE ritmo_auth.login_attempts_id_seq TO ritmo_app;
-- Accepting an invitation happens before the user is a member, so it
-- goes through definer functions instead of table grants.
REVOKE EXECUTE ON FUNCTION ritmo.invitation_preview(bytea), ritmo.accept_invitation(bytea, uuid) FROM ritmo_user, PUBLIC;
GRANT EXECUTE ON FUNCTION ritmo.invitation_preview(bytea), ritmo.accept_invitation(bytea, uuid) TO ritmo_app;
