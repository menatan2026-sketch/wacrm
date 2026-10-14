-- ============================================================
-- 001_foundation.sql — Ritmo Phase 1 schema
--
-- Tenancy model
--   Every tenant row carries org_id. Row-Level Security is enabled on
--   every table in `public`. The web server connects as `ritmo_app`
--   and runs each request inside a transaction that does
--     SET LOCAL ROLE authenticated;
--     set_config('request.jwt.claims', '{"sub": "<user id>"}', true);
--   so every query is filtered by the policies below. `auth.uid()`
--   reads that claim, which is how Supabase works too, so moving to a
--   managed Supabase project later keeps the policies unchanged.
--
-- Composite foreign keys (org_id, id) make it impossible for a row to
-- reference another tenant's row, even if application code has a bug.
--
-- Roles inside an org: owner > admin > manager > employee.
--   Managers are scoped to the locations listed in member_locations.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ------------------------------------------------------------
-- Database roles (Supabase-compatible names)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ritmo_app') THEN
    CREATE ROLE ritmo_app LOGIN NOINHERIT;
  END IF;
END $$;
GRANT authenticated TO ritmo_app;

-- ------------------------------------------------------------
-- auth schema: users, sessions, invitations.
-- Only ritmo_app (the server) touches these directly; the
-- `authenticated` role cannot read password hashes or sessions.
-- ------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;

CREATE TABLE auth.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext NOT NULL UNIQUE,
  password_hash text,
  full_name     text NOT NULL,
  locale        text NOT NULL DEFAULT 'he' CHECK (locale IN ('he', 'en')),
  theme         text NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth.sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash   bytea NOT NULL UNIQUE,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON auth.sessions(user_id);

-- Login throttling: failed attempts per email in a rolling window.
CREATE TABLE auth.login_attempts (
  id         bigserial PRIMARY KEY,
  email      citext NOT NULL,
  succeeded  boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_email_idx ON auth.login_attempts(email, created_at DESC);

-- ------------------------------------------------------------
-- Generic updated_at trigger
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- ------------------------------------------------------------
-- Organizations and structure
-- ------------------------------------------------------------
CREATE TABLE public.organizations (
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
CREATE TRIGGER organizations_touch BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.locations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
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

CREATE TABLE public.positions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name              text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  -- Schedule tint, from the brand palette (shift-green … shift-stone).
  color             text NOT NULL DEFAULT 'stone' CHECK (color IN ('green', 'sun', 'sky', 'clay', 'stone')),
  sort_order        integer NOT NULL DEFAULT 0,
  UNIQUE (org_id, id),
  UNIQUE (org_id, name)
);

CREATE TABLE public.members (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Nullable: a person can exist (and be scheduled) before accepting an invite.
  user_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name          text NOT NULL CHECK (length(first_name) BETWEEN 1 AND 60),
  last_name           text NOT NULL DEFAULT '' CHECK (length(last_name) <= 60),
  email               citext,
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
  FOREIGN KEY (org_id, position_id) REFERENCES public.positions(org_id, id),
  FOREIGN KEY (org_id, primary_location_id) REFERENCES public.locations(org_id, id)
);
CREATE INDEX members_user_idx ON public.members(user_id);
CREATE TRIGGER members_touch BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Where a person works. For managers this is also their scope.
CREATE TABLE public.member_locations (
  org_id      uuid NOT NULL,
  member_id   uuid NOT NULL,
  location_id uuid NOT NULL,
  PRIMARY KEY (member_id, location_id),
  FOREIGN KEY (org_id, member_id) REFERENCES public.members(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, location_id) REFERENCES public.locations(org_id, id) ON DELETE CASCADE
);
CREATE INDEX member_locations_location_idx ON public.member_locations(location_id);

-- Pay rates are restricted: separate table, stricter policy.
CREATE TABLE public.member_pay (
  org_id            uuid NOT NULL,
  member_id         uuid PRIMARY KEY,
  hourly_rate_minor bigint NOT NULL CHECK (hourly_rate_minor >= 0),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, member_id) REFERENCES public.members(org_id, id) ON DELETE CASCADE
);

CREATE TABLE public.invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  member_id   uuid NOT NULL,
  token_hash  bytea NOT NULL UNIQUE,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '14 days',
  accepted_at timestamptz,
  FOREIGN KEY (org_id, member_id) REFERENCES public.members(org_id, id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Scheduling
-- ------------------------------------------------------------
CREATE TABLE public.shifts (
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
  FOREIGN KEY (org_id, location_id) REFERENCES public.locations(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, position_id) REFERENCES public.positions(org_id, id),
  FOREIGN KEY (org_id, member_id) REFERENCES public.members(org_id, id) ON DELETE SET NULL (member_id),
  -- One person can't be in two places at once.
  EXCLUDE USING gist (member_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE (member_id IS NOT NULL)
);
CREATE INDEX shifts_org_time_idx ON public.shifts(org_id, starts_at);
CREATE INDEX shifts_member_idx ON public.shifts(member_id, starts_at);
CREATE TRIGGER shifts_touch BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.shift_requests (
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
  FOREIGN KEY (org_id, shift_id) REFERENCES public.shifts(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, requester_member_id) REFERENCES public.members(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, target_member_id) REFERENCES public.members(org_id, id) ON DELETE CASCADE,
  CHECK ((kind = 'swap') = (target_member_id IS NOT NULL))
);
-- Only one pending request per shift and requester.
CREATE UNIQUE INDEX shift_requests_one_pending
  ON public.shift_requests(shift_id, requester_member_id) WHERE status = 'pending';

-- ------------------------------------------------------------
-- Time & attendance
-- ------------------------------------------------------------
-- Append-only evidence. No UPDATE or DELETE policy exists.
CREATE TABLE public.time_events (
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
  FOREIGN KEY (org_id, member_id) REFERENCES public.members(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, location_id) REFERENCES public.locations(org_id, id)
);
CREATE INDEX time_events_member_idx ON public.time_events(member_id, occurred_at DESC);

-- Payroll-relevant intervals derived from events. Manager edits change
-- the entry (with a reason), never the event.
CREATE TABLE public.time_entries (
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
  FOREIGN KEY (org_id, member_id) REFERENCES public.members(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, location_id) REFERENCES public.locations(org_id, id),
  FOREIGN KEY (org_id, shift_id) REFERENCES public.shifts(org_id, id) ON DELETE SET NULL (shift_id)
);
-- At most one open entry per person.
CREATE UNIQUE INDEX time_entries_one_open ON public.time_entries(member_id) WHERE ended_at IS NULL;
CREATE INDEX time_entries_member_date_idx ON public.time_entries(member_id, work_date);
CREATE INDEX time_entries_org_date_idx ON public.time_entries(org_id, work_date);
CREATE TRIGGER time_entries_touch BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.timesheet_approvals (
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
  FOREIGN KEY (org_id, member_id) REFERENCES public.members(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, decided_by) REFERENCES public.members(org_id, id),
  CHECK (decided_by <> member_id) -- nobody approves their own hours
);

CREATE TABLE public.anomalies (
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
  FOREIGN KEY (org_id, member_id) REFERENCES public.members(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, time_entry_id) REFERENCES public.time_entries(org_id, id) ON DELETE CASCADE
);
CREATE INDEX anomalies_open_idx ON public.anomalies(org_id) WHERE status = 'open';

-- ------------------------------------------------------------
-- Computer activity (desktop agent uploads aggregates, never content)
-- ------------------------------------------------------------
CREATE TABLE public.activity_segments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL,
  member_id  uuid NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at   timestamptz NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('focus', 'neutral', 'idle', 'break')),
  app        text CHECK (length(app) <= 80), -- app name or domain only
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at > started_at),
  FOREIGN KEY (org_id, member_id) REFERENCES public.members(org_id, id) ON DELETE CASCADE
);
CREATE INDEX activity_member_time_idx ON public.activity_segments(member_id, started_at);

-- ------------------------------------------------------------
-- Chat
-- ------------------------------------------------------------
CREATE TABLE public.conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('channel', 'dm')),
  name            text CHECK (length(name) <= 80),
  location_id     uuid,
  created_by      uuid,
  last_message_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  CHECK ((kind = 'channel') = (name IS NOT NULL)),
  FOREIGN KEY (org_id, location_id) REFERENCES public.locations(org_id, id) ON DELETE CASCADE
);

CREATE TABLE public.conversation_members (
  org_id          uuid NOT NULL,
  conversation_id uuid NOT NULL,
  member_id       uuid NOT NULL,
  last_read_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, member_id),
  FOREIGN KEY (org_id, conversation_id) REFERENCES public.conversations(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, member_id) REFERENCES public.members(org_id, id) ON DELETE CASCADE
);
CREATE INDEX conversation_members_member_idx ON public.conversation_members(member_id);

CREATE TABLE public.messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL,
  conversation_id  uuid NOT NULL,
  sender_member_id uuid NOT NULL,
  body             text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, conversation_id) REFERENCES public.conversations(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, sender_member_id) REFERENCES public.members(org_id, id) ON DELETE CASCADE
);
CREATE INDEX messages_conversation_idx ON public.messages(conversation_id, created_at DESC);

-- ------------------------------------------------------------
-- Audit log: append-only, written through public.audit() only.
-- ------------------------------------------------------------
CREATE TABLE public.audit_log (
  id              bigserial PRIMARY KEY,
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id   uuid,
  actor_member_id uuid,
  action          text NOT NULL,
  target_type     text,
  target_id       uuid,
  details         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_org_idx ON public.audit_log(org_id, created_at DESC);

-- ============================================================
-- Authorization helpers. SECURITY DEFINER so policies can consult
-- membership without recursing into the members policy. All are
-- STABLE and pin search_path.
-- ============================================================
CREATE OR REPLACE FUNCTION public.my_member_id(p_org uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT id FROM public.members
  WHERE org_id = p_org AND user_id = auth.uid() AND status = 'active'
$$;

CREATE OR REPLACE FUNCTION public.my_role(p_org uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT role FROM public.members
  WHERE org_id = p_org AND user_id = auth.uid() AND status = 'active'
$$;

CREATE OR REPLACE FUNCTION public.is_member(p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.my_member_id(p_org) IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.is_admin(p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(public.my_role(p_org) IN ('owner', 'admin'), false)
$$;

-- Owner/admin: every location. Manager: the locations they're assigned to.
CREATE OR REPLACE FUNCTION public.can_manage_location(p_org uuid, p_location uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE public.my_role(p_org)
    WHEN 'owner' THEN true
    WHEN 'admin' THEN true
    WHEN 'manager' THEN EXISTS (
      SELECT 1 FROM public.member_locations ml
      WHERE ml.member_id = public.my_member_id(p_org) AND ml.location_id = p_location)
    ELSE false
  END
$$;

-- Owner/admin: anyone. Manager: people who share one of their locations
-- (never owners or admins). Nobody "manages" themselves through this path.
CREATE OR REPLACE FUNCTION public.can_manage_member(p_org uuid, p_member uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE public.my_role(p_org)
    WHEN 'owner' THEN true
    WHEN 'admin' THEN true
    WHEN 'manager' THEN EXISTS (
      SELECT 1
      FROM public.members target
      JOIN public.member_locations tl ON tl.member_id = target.id
      JOIN public.member_locations ml ON ml.location_id = tl.location_id
      WHERE target.id = p_member AND target.org_id = p_org
        AND target.role IN ('manager', 'employee')
        AND ml.member_id = public.my_member_id(p_org))
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conversation uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members cm
    JOIN public.members m ON m.id = cm.member_id
    WHERE cm.conversation_id = p_conversation AND m.user_id = auth.uid() AND m.status = 'active')
$$;

-- Audit writer: the only way rows get into audit_log.
CREATE OR REPLACE FUNCTION public.audit(
  p_org uuid, p_action text, p_target_type text, p_target_id uuid, p_details jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_member(p_org) THEN
    RAISE EXCEPTION 'not a member of this organization' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.audit_log (org_id, actor_user_id, actor_member_id, action, target_type, target_id, details)
  VALUES (p_org, auth.uid(), public.my_member_id(p_org), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb));
END $$;

-- ============================================================
-- Guard rails enforced in triggers (independent of the app)
-- ============================================================

-- Role changes: only owners/admins may grant manager+, only owners may
-- grant owner/admin, and nobody changes their own role.
CREATE OR REPLACE FUNCTION public.guard_member_role() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  actor_role text := public.my_role(NEW.org_id);
BEGIN
  -- Seeds and migrations run without a user; trust them.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND NEW.role IS NOT DISTINCT FROM OLD.role THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND OLD.user_id = auth.uid() THEN
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
CREATE TRIGGER members_guard_role BEFORE INSERT OR UPDATE OF role ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.guard_member_role();

-- Employees may only close/break their own open entry; edits to the
-- start time or to closed entries require a manager and a reason.
CREATE OR REPLACE FUNCTION public.guard_time_entry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.can_manage_member(NEW.org_id, NEW.member_id) THEN
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
CREATE TRIGGER time_entries_guard BEFORE INSERT OR UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.guard_time_entry();

-- ============================================================
-- Realtime: notify listeners; the server re-reads under the
-- subscriber's RLS before forwarding anything.
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('ritmo_events', json_build_object(
    'table', TG_TABLE_NAME,
    'org_id', NEW.org_id,
    'id', NEW.id,
    'conversation_id', CASE WHEN TG_TABLE_NAME = 'messages' THEN NEW.conversation_id END
  )::text);
  RETURN NEW;
END $$;
CREATE TRIGGER messages_notify AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_change();
CREATE TRIGGER time_events_notify AFTER INSERT ON public.time_events
  FOR EACH ROW EXECUTE FUNCTION public.notify_change();
CREATE TRIGGER shift_requests_notify AFTER INSERT OR UPDATE ON public.shift_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_change();

CREATE OR REPLACE FUNCTION public.bump_conversation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;
CREATE TRIGGER messages_bump AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversation();

-- ============================================================
-- Row-Level Security
-- ============================================================
ALTER TABLE public.organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_locations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_pay           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_approvals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomalies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_segments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log            ENABLE ROW LEVEL SECURITY;

-- organizations
CREATE POLICY org_read ON public.organizations FOR SELECT USING (public.is_member(id));
CREATE POLICY org_update ON public.organizations FOR UPDATE
  USING (public.is_admin(id)) WITH CHECK (public.is_admin(id));

-- locations, positions: everyone in the org reads; owners/admins write
CREATE POLICY loc_read ON public.locations FOR SELECT USING (public.is_member(org_id));
CREATE POLICY loc_write ON public.locations FOR ALL
  USING (public.is_admin(org_id)) WITH CHECK (public.is_admin(org_id));
CREATE POLICY pos_read ON public.positions FOR SELECT USING (public.is_member(org_id));
CREATE POLICY pos_write ON public.positions FOR ALL
  USING (public.is_admin(org_id)) WITH CHECK (public.is_admin(org_id));

-- members: the directory is visible to the whole org (like a staff list);
-- managers add/edit people in their locations, admins everyone.
CREATE POLICY members_read ON public.members FOR SELECT USING (public.is_member(org_id));
CREATE POLICY members_insert ON public.members FOR INSERT WITH CHECK (
  public.is_admin(org_id)
  OR (public.my_role(org_id) = 'manager' AND role = 'employee'
      AND public.can_manage_location(org_id, primary_location_id)));
CREATE POLICY members_update ON public.members FOR UPDATE
  USING (public.can_manage_member(org_id, id) OR user_id = auth.uid())
  WITH CHECK (public.can_manage_member(org_id, id) OR user_id = auth.uid());
CREATE POLICY members_delete ON public.members FOR DELETE USING (public.is_admin(org_id) AND role <> 'owner');

CREATE POLICY ml_read ON public.member_locations FOR SELECT USING (public.is_member(org_id));
CREATE POLICY ml_write ON public.member_locations FOR ALL
  USING (public.is_admin(org_id) OR (public.can_manage_member(org_id, member_id) AND public.can_manage_location(org_id, location_id)))
  WITH CHECK (public.is_admin(org_id) OR (public.can_manage_location(org_id, location_id)
    AND EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.role = 'employee')));

-- pay: yourself, or someone who manages you
CREATE POLICY pay_read ON public.member_pay FOR SELECT
  USING (member_id = public.my_member_id(org_id) OR public.can_manage_member(org_id, member_id));
CREATE POLICY pay_write ON public.member_pay FOR ALL
  USING (public.can_manage_member(org_id, member_id))
  WITH CHECK (public.can_manage_member(org_id, member_id));

CREATE POLICY inv_read ON public.invitations FOR SELECT USING (public.can_manage_member(org_id, member_id));
CREATE POLICY inv_write ON public.invitations FOR INSERT WITH CHECK (public.can_manage_member(org_id, member_id));

-- shifts: drafts are visible only to whoever can edit that location
CREATE POLICY shifts_read ON public.shifts FOR SELECT USING (
  public.is_member(org_id) AND (status = 'published' OR public.can_manage_location(org_id, location_id)));
CREATE POLICY shifts_write ON public.shifts FOR ALL
  USING (public.can_manage_location(org_id, location_id))
  WITH CHECK (public.can_manage_location(org_id, location_id));

-- shift requests
CREATE POLICY sr_read ON public.shift_requests FOR SELECT USING (
  requester_member_id = public.my_member_id(org_id)
  OR target_member_id = public.my_member_id(org_id)
  OR EXISTS (SELECT 1 FROM public.shifts s WHERE s.id = shift_id AND public.can_manage_location(s.org_id, s.location_id)));
CREATE POLICY sr_insert ON public.shift_requests FOR INSERT WITH CHECK (
  requester_member_id = public.my_member_id(org_id) AND status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.shifts s WHERE s.id = shift_id AND s.status = 'published' AND s.starts_at > now()
      AND ((kind IN ('swap', 'drop') AND s.member_id = requester_member_id)
        OR (kind = 'claim' AND s.member_id IS NULL))));
CREATE POLICY sr_update ON public.shift_requests FOR UPDATE USING (
  requester_member_id = public.my_member_id(org_id)
  OR EXISTS (SELECT 1 FROM public.shifts s WHERE s.id = shift_id AND public.can_manage_location(s.org_id, s.location_id)))
  WITH CHECK (
  (requester_member_id = public.my_member_id(org_id) AND status IN ('pending', 'cancelled'))
  OR EXISTS (SELECT 1 FROM public.shifts s WHERE s.id = shift_id AND public.can_manage_location(s.org_id, s.location_id)));

-- time events: append-only (INSERT + SELECT, nothing else)
CREATE POLICY te_read ON public.time_events FOR SELECT USING (
  member_id = public.my_member_id(org_id) OR public.can_manage_member(org_id, member_id));
CREATE POLICY te_insert ON public.time_events FOR INSERT WITH CHECK (
  (member_id = public.my_member_id(org_id) AND source <> 'manager')
  OR (public.can_manage_member(org_id, member_id) AND source = 'manager'));

CREATE POLICY entries_read ON public.time_entries FOR SELECT USING (
  member_id = public.my_member_id(org_id) OR public.can_manage_member(org_id, member_id));
CREATE POLICY entries_insert ON public.time_entries FOR INSERT WITH CHECK (
  member_id = public.my_member_id(org_id) OR public.can_manage_member(org_id, member_id));
CREATE POLICY entries_update ON public.time_entries FOR UPDATE
  USING (member_id = public.my_member_id(org_id) OR public.can_manage_member(org_id, member_id))
  WITH CHECK (member_id = public.my_member_id(org_id) OR public.can_manage_member(org_id, member_id));

CREATE POLICY tsa_read ON public.timesheet_approvals FOR SELECT USING (
  member_id = public.my_member_id(org_id) OR public.can_manage_member(org_id, member_id));
CREATE POLICY tsa_write ON public.timesheet_approvals FOR ALL
  USING (public.can_manage_member(org_id, member_id))
  WITH CHECK (public.can_manage_member(org_id, member_id) AND decided_by = public.my_member_id(org_id));

CREATE POLICY anomalies_read ON public.anomalies FOR SELECT USING (
  member_id = public.my_member_id(org_id) OR public.can_manage_member(org_id, member_id));
CREATE POLICY anomalies_insert ON public.anomalies FOR INSERT WITH CHECK (
  member_id = public.my_member_id(org_id) OR public.can_manage_member(org_id, member_id));
CREATE POLICY anomalies_update ON public.anomalies FOR UPDATE
  USING (public.can_manage_member(org_id, member_id))
  WITH CHECK (public.can_manage_member(org_id, member_id));

-- activity: the employee always sees exactly what their manager sees
CREATE POLICY activity_read ON public.activity_segments FOR SELECT USING (
  member_id = public.my_member_id(org_id) OR public.can_manage_member(org_id, member_id));
CREATE POLICY activity_insert ON public.activity_segments FOR INSERT WITH CHECK (
  member_id = public.my_member_id(org_id));

-- chat
CREATE POLICY conv_read ON public.conversations FOR SELECT USING (public.is_conversation_member(id));
CREATE POLICY conv_insert ON public.conversations FOR INSERT WITH CHECK (
  public.is_member(org_id) AND created_by = public.my_member_id(org_id)
  AND (kind = 'dm' OR public.my_role(org_id) IN ('owner', 'admin', 'manager')));
CREATE POLICY cm_read ON public.conversation_members FOR SELECT USING (public.is_conversation_member(conversation_id));
CREATE POLICY cm_insert ON public.conversation_members FOR INSERT WITH CHECK (
  public.is_member(org_id) AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND c.created_by = public.my_member_id(c.org_id)));
CREATE POLICY cm_update_own ON public.conversation_members FOR UPDATE
  USING (member_id = public.my_member_id(org_id)) WITH CHECK (member_id = public.my_member_id(org_id));
CREATE POLICY msg_read ON public.messages FOR SELECT USING (public.is_conversation_member(conversation_id));
CREATE POLICY msg_insert ON public.messages FOR INSERT WITH CHECK (
  public.is_conversation_member(conversation_id) AND sender_member_id = public.my_member_id(org_id));

CREATE POLICY audit_read ON public.audit_log FOR SELECT USING (public.is_admin(org_id));

-- ============================================================
-- Organization creation (self-serve signup). A brand-new user isn't
-- a member of anything yet, so this one step runs as definer.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_organization(
  p_name text, p_slug text, p_first_name text, p_last_name text, p_locale text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_org uuid;
  v_member uuid;
  v_email citext;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in first' USING ERRCODE = '42501';
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.organizations (name, slug, locale) VALUES (p_name, p_slug, coalesce(p_locale, 'he'))
    RETURNING id INTO v_org;
  INSERT INTO public.members (org_id, user_id, first_name, last_name, email, role, status, avatar_color)
    VALUES (v_org, auth.uid(), p_first_name, coalesce(p_last_name, ''), v_email, 'owner', 'active', 'green')
    RETURNING id INTO v_member;
  INSERT INTO public.audit_log (org_id, actor_user_id, actor_member_id, action, target_type, target_id)
    VALUES (v_org, auth.uid(), v_member, 'organization.create', 'organization', v_org);
  RETURN v_org;
END $$;

-- Start (or reuse) a direct conversation between me and another member.
CREATE OR REPLACE FUNCTION public.open_dm(p_org uuid, p_other uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := public.my_member_id(p_org);
  v_conv uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not a member' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = p_other AND org_id = p_org AND status = 'active') THEN
    RAISE EXCEPTION 'unknown colleague' USING ERRCODE = '22023';
  END IF;
  IF v_me = p_other THEN RAISE EXCEPTION 'cannot message yourself' USING ERRCODE = '22023'; END IF;
  SELECT c.id INTO v_conv FROM public.conversations c
    WHERE c.org_id = p_org AND c.kind = 'dm'
      AND EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = c.id AND member_id = v_me)
      AND EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = c.id AND member_id = p_other)
    LIMIT 1;
  IF v_conv IS NOT NULL THEN RETURN v_conv; END IF;
  INSERT INTO public.conversations (org_id, kind, created_by) VALUES (p_org, 'dm', v_me) RETURNING id INTO v_conv;
  INSERT INTO public.conversation_members (org_id, conversation_id, member_id)
    VALUES (p_org, v_conv, v_me), (p_org, v_conv, p_other);
  RETURN v_conv;
END $$;

-- Approve or reject a shift request atomically (applies the change).
CREATE OR REPLACE FUNCTION public.decide_shift_request(p_request uuid, p_approve boolean) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  r public.shift_requests;
  s public.shifts;
BEGIN
  SELECT * INTO r FROM public.shift_requests WHERE id = p_request FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' THEN
    RAISE EXCEPTION 'request is no longer pending' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO s FROM public.shifts WHERE id = r.shift_id FOR UPDATE;
  IF NOT public.can_manage_location(s.org_id, s.location_id) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_approve THEN
    IF r.kind = 'swap' THEN
      UPDATE public.shifts SET member_id = r.target_member_id WHERE id = s.id;
    ELSIF r.kind = 'claim' THEN
      IF s.member_id IS NOT NULL THEN
        RAISE EXCEPTION 'shift was already taken' USING ERRCODE = '22023';
      END IF;
      UPDATE public.shifts SET member_id = r.requester_member_id WHERE id = s.id;
      UPDATE public.shift_requests SET status = 'rejected', decided_by = public.my_member_id(s.org_id), decided_at = now()
        WHERE shift_id = s.id AND id <> r.id AND status = 'pending';
    ELSE
      UPDATE public.shifts SET member_id = NULL WHERE id = s.id;
    END IF;
  END IF;
  UPDATE public.shift_requests
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        decided_by = public.my_member_id(s.org_id), decided_at = now()
    WHERE id = r.id;
  PERFORM public.audit(s.org_id, CASE WHEN p_approve THEN 'shift_request.approve' ELSE 'shift_request.reject' END,
    'shift_request', r.id, jsonb_build_object('kind', r.kind, 'shift_id', s.id));
END $$;

-- ============================================================
-- Grants. `authenticated` gets table privileges; RLS narrows rows.
-- No UPDATE/DELETE on time_events or audit_log for anyone.
-- ============================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA auth TO authenticated, ritmo_app;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, ritmo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.organizations, public.locations, public.positions, public.members, public.member_locations,
  public.member_pay, public.shifts, public.shift_requests, public.time_entries, public.timesheet_approvals,
  public.anomalies, public.conversations, public.conversation_members, public.messages
  TO authenticated;
GRANT SELECT, INSERT ON public.time_events, public.activity_segments, public.invitations TO authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
REVOKE ALL ON public.audit_log FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- The server reads auth tables directly (login, sessions, invites).
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.users, auth.sessions, auth.login_attempts TO ritmo_app;
GRANT USAGE ON SEQUENCE auth.login_attempts_id_seq TO ritmo_app;
-- Accepting an invitation happens before the user is a member.
GRANT SELECT, UPDATE ON public.invitations TO ritmo_app;
GRANT SELECT, UPDATE ON public.members TO ritmo_app;
GRANT SELECT ON public.organizations TO ritmo_app;
