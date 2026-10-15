-- ============================================================
-- 002_demo.sql — "Café Alma", the living demo company
--
-- The demo must look alive whenever someone opens it: people on shift
-- right now, one late, a few on break, computer activity growing. A
-- static seed goes stale in a day, so the demo is simulated instead:
--
--   ritmo.seed_demo()        creates the company once (idempotent)
--   ritmo.demo_build(org)    once a day: rebuilds 2 weeks of history,
--                            this week (published) and next week (draft)
--   ritmo.demo_simulate(...) plays a day up to a given moment: clock-ins,
--                            breaks, clock-outs, anomalies, activity.
--                            Deterministic per person and day, idempotent.
--   ritmo.demo_refresh(org)  called by the app on page load; runs the
--                            daily build and the tick (at most once a
--                            minute). Only for organizations marked
--                            is_demo, and only for their members.
--
-- People with a login (Michal, Omer, Dana, Shiran) are never simulated:
-- whoever tries the demo plays them for real.
-- ============================================================

ALTER TABLE ritmo.organizations
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_built_on date,
  ADD COLUMN IF NOT EXISTS demo_ticked_at timestamptz;

CREATE OR REPLACE FUNCTION ritmo.demo_hash(p text) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT abs(hashtext(p)) $$;

-- Local wall-clock time on a date in Israel → timestamptz.
CREATE OR REPLACE FUNCTION ritmo.demo_at(p_date date, p_time time) RETURNS timestamptz
LANGUAGE sql IMMUTABLE AS $$ SELECT (p_date + p_time) AT TIME ZONE 'Asia/Jerusalem' $$;

CREATE OR REPLACE FUNCTION ritmo.demo_today() RETURNS date
LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Asia/Jerusalem')::date $$;

-- ------------------------------------------------------------
-- Play one day of the demo up to p_upto.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION ritmo.demo_simulate(p_org uuid, p_date date, p_upto timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ritmo, pg_temp AS $$
DECLARE
  s record;
  h integer;
  late integer;
  extra integer;
  cin timestamptz;
  cout timestamptz;
  bstart timestamptz;
  bend timestamptz;
  is_long boolean;
  skip_break boolean;
  outside boolean;
  e ritmo.time_entries;
  src text;
  seg_start timestamptz;
  seg_end timestamptz;
  seg_kind text;
  seg_app text;
  i integer;
  -- Anomalies before this week are already handled; last week's stay open.
  week0 date := ritmo.demo_today() - extract(dow FROM ritmo.demo_today())::integer;
  old_status text := CASE WHEN p_date < week0 - 7 THEN 'resolved' ELSE 'open' END;
BEGIN
  FOR s IN
    SELECT sh.*, m.works_on, l.name AS loc_name, l.lat, l.lng, l.geofence_radius_m
    FROM ritmo.shifts sh
    JOIN ritmo.members m ON m.id = sh.member_id
    JOIN ritmo.locations l ON l.id = sh.location_id
    WHERE sh.org_id = p_org AND sh.status = 'published' AND m.user_id IS NULL AND m.status = 'active'
      AND (sh.starts_at AT TIME ZONE 'Asia/Jerusalem')::date = p_date
  LOOP
    h := ritmo.demo_hash(s.member_id::text || p_date::text);
    IF h % 23 = 0 THEN CONTINUE; END IF; -- an occasional no-show

    late := CASE WHEN h % 7 = 0 THEN 9 + h % 12 ELSE -(h % 6) END;
    cin := s.starts_at + make_interval(mins => late);
    IF cin > p_upto THEN CONTINUE; END IF;

    extra := CASE WHEN s.loc_name = 'חיפה' AND h % 3 = 0 THEN 75 WHEN h % 9 = 0 THEN 40 ELSE h % 6 END;
    cout := s.ends_at + make_interval(mins => extra);
    is_long := s.ends_at - s.starts_at >= interval '6 hours';
    skip_break := h % 41 = 0;
    bstart := s.starts_at + interval '4 hours' + make_interval(mins => h % 20);
    bend := bstart + interval '30 minutes';
    outside := h % 13 = 0 AND s.works_on <> 'computer';
    src := CASE WHEN s.works_on = 'computer' THEN 'desktop' ELSE 'mobile' END;

    SELECT * INTO e FROM ritmo.time_entries WHERE member_id = s.member_id AND shift_id = s.id;
    IF NOT FOUND THEN
      INSERT INTO ritmo.time_events (id, org_id, member_id, type, occurred_at, received_at, source, location_id,
                                     lat, lng, accuracy_m, distance_m, inside_geofence)
      VALUES (md5(s.id::text || 'in')::uuid, p_org, s.member_id, 'clock_in', cin, cin, src, s.location_id,
              CASE WHEN src = 'desktop' THEN NULL WHEN outside THEN s.lat + 0.0029 ELSE s.lat + 0.0002 END,
              CASE WHEN src = 'desktop' THEN NULL ELSE s.lng END,
              CASE WHEN src = 'desktop' THEN NULL ELSE 6 + h % 9 END,
              CASE WHEN src = 'desktop' THEN NULL WHEN outside THEN 320 ELSE 20 + h % 40 END,
              CASE WHEN src = 'desktop' THEN NULL ELSE NOT outside END)
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO ritmo.time_entries (org_id, member_id, location_id, shift_id, work_date, started_at)
      VALUES (p_org, s.member_id, s.location_id, s.id, p_date, cin)
      RETURNING * INTO e;
      IF outside THEN
        INSERT INTO ritmo.anomalies (org_id, member_id, time_entry_id, kind, details, status, created_at)
        VALUES (p_org, s.member_id, e.id, 'out_of_geofence',
                jsonb_build_object('distance_m', 320, 'location', s.loc_name),
                CASE WHEN p_date < ritmo.demo_today() THEN 'resolved' ELSE 'open' END, cin);
      END IF;
      IF late > 5 THEN
        INSERT INTO ritmo.anomalies (org_id, member_id, time_entry_id, kind, details, status, created_at)
        VALUES (p_org, s.member_id, e.id, 'late', jsonb_build_object('minutes', late),
                CASE WHEN p_date < ritmo.demo_today() THEN 'resolved' ELSE 'open' END, cin);
      END IF;
    END IF;

    IF e.status = 'closed' THEN CONTINUE; END IF;

    -- Break
    IF is_long AND NOT skip_break THEN
      IF p_upto >= bend THEN
        INSERT INTO ritmo.time_events (id, org_id, member_id, type, occurred_at, received_at, source, location_id)
        VALUES (md5(s.id::text || 'bs')::uuid, p_org, s.member_id, 'break_start', bstart, bstart, src, s.location_id),
               (md5(s.id::text || 'be')::uuid, p_org, s.member_id, 'break_end', bend, bend, src, s.location_id)
        ON CONFLICT (id) DO NOTHING;
        UPDATE ritmo.time_entries SET break_minutes = 30, break_started_at = NULL WHERE id = e.id;
      ELSIF p_upto >= bstart THEN
        INSERT INTO ritmo.time_events (id, org_id, member_id, type, occurred_at, received_at, source, location_id)
        VALUES (md5(s.id::text || 'bs')::uuid, p_org, s.member_id, 'break_start', bstart, bstart, src, s.location_id)
        ON CONFLICT (id) DO NOTHING;
        UPDATE ritmo.time_entries SET break_started_at = bstart WHERE id = e.id;
      END IF;
    END IF;

    -- Clock out
    IF p_upto >= cout THEN
      INSERT INTO ritmo.time_events (id, org_id, member_id, type, occurred_at, received_at, source, location_id)
      VALUES (md5(s.id::text || 'out')::uuid, p_org, s.member_id, 'clock_out', cout, cout, src, s.location_id)
      ON CONFLICT (id) DO NOTHING;
      UPDATE ritmo.time_entries SET ended_at = cout, status = 'closed', break_started_at = NULL WHERE id = e.id;
      IF is_long AND skip_break THEN
        INSERT INTO ritmo.anomalies (org_id, member_id, time_entry_id, kind, details, status, created_at)
        VALUES (p_org, s.member_id, e.id, 'missing_break', '{}'::jsonb, old_status, cout);
      END IF;
    END IF;

    -- Computer activity (aggregates only: app name, active/idle), rebuilt for the day
    IF s.works_on IN ('computer', 'both') THEN
      DELETE FROM ritmo.activity_segments
        WHERE member_id = s.member_id AND (started_at AT TIME ZONE 'Asia/Jerusalem')::date = p_date;
      seg_start := cin;
      i := 0;
      WHILE seg_start < least(cout, p_upto) LOOP
        seg_end := least(seg_start + interval '25 minutes' + make_interval(mins => (h + i) % 20), cout, p_upto);
        seg_kind := CASE
          WHEN is_long AND NOT skip_break AND seg_start >= bstart AND seg_start < bend THEN 'break'
          WHEN (h + i * 7) % 10 < 6 THEN 'focus'
          WHEN (h + i * 7) % 10 < 9 THEN 'neutral'
          ELSE 'idle' END;
        seg_app := CASE seg_kind
          WHEN 'focus' THEN (ARRAY['Excel', 'Priority', 'Google Sheets', 'Figma'])[1 + (h + i) % 4]
          WHEN 'neutral' THEN (ARRAY['Zoom', 'Outlook', 'WhatsApp Web'])[1 + (h + i) % 3]
          ELSE NULL END;
        IF seg_end > seg_start THEN
          INSERT INTO ritmo.activity_segments (org_id, member_id, started_at, ended_at, kind, app)
          VALUES (p_org, s.member_id, seg_start, seg_end, seg_kind, seg_app);
        END IF;
        seg_start := seg_end;
        i := i + 1;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- Daily rebuild: 2 weeks of history, this week, next week (draft).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION ritmo.demo_build(p_org uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ritmo, pg_temp AS $$
DECLARE
  today date := ritmo.demo_today();
  ws date := today - extract(dow FROM today)::integer; -- Sunday
  d date;
  m record;
  hm integer;
  off_day integer;
  morning boolean;
  st time;
  en time;
  brk integer;
  owner_id uuid;
  dana uuid;
  omer uuid;
  diz uuid;
  ramat uuid;
  haifa uuid;
  barista uuid;
  next_shift uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ritmo.organizations WHERE id = p_org AND is_demo) THEN
    RAISE EXCEPTION 'not a demo organization' USING ERRCODE = '42501';
  END IF;

  DELETE FROM ritmo.shift_requests WHERE org_id = p_org;
  DELETE FROM ritmo.anomalies WHERE org_id = p_org;
  DELETE FROM ritmo.timesheet_approvals WHERE org_id = p_org;
  DELETE FROM ritmo.activity_segments WHERE org_id = p_org;
  DELETE FROM ritmo.time_entries WHERE org_id = p_org;
  DELETE FROM ritmo.time_events WHERE org_id = p_org;
  DELETE FROM ritmo.shifts WHERE org_id = p_org;

  SELECT id INTO owner_id FROM ritmo.members WHERE org_id = p_org AND role = 'owner' LIMIT 1;
  SELECT id INTO dana FROM ritmo.members WHERE org_id = p_org AND email = 'dana@cafe-alma.test';
  SELECT id INTO omer FROM ritmo.members WHERE org_id = p_org AND email = 'omer@cafe-alma.test';
  SELECT id INTO diz FROM ritmo.locations WHERE org_id = p_org AND name = 'דיזנגוף';
  SELECT id INTO haifa FROM ritmo.locations WHERE org_id = p_org AND name = 'חיפה';
  SELECT id INTO ramat FROM ritmo.locations WHERE org_id = p_org AND name = 'רמת החייל';
  SELECT id INTO barista FROM ritmo.positions WHERE org_id = p_org AND name = 'בריסטה';

  -- Shifts for four weeks: two past, this one, next one (draft).
  FOR m IN
    SELECT mb.id, mb.position_id, mb.primary_location_id, mb.works_on, mb.role, p.name AS pos, l.kind AS loc_kind
    FROM ritmo.members mb
    JOIN ritmo.locations l ON l.id = mb.primary_location_id
    LEFT JOIN ritmo.positions p ON p.id = mb.position_id
    WHERE mb.org_id = p_org AND mb.status = 'active' AND mb.role <> 'owner'
  LOOP
    hm := ritmo.demo_hash(m.id::text);
    off_day := CASE WHEN m.id = dana THEN 1 ELSE hm % 6 END; -- Dana is off on Mondays
    FOR d IN SELECT generate_series(ws - 14, ws + 13, interval '1 day')::date LOOP
      IF m.loc_kind = 'office' THEN
        CONTINUE WHEN extract(dow FROM d) > 4;
        st := '09:00'; en := '17:30'; brk := 30;
      ELSE
        IF extract(dow FROM d) = 6 THEN
          -- Saturday: two people at Dizengoff
          CONTINUE WHEN NOT (m.primary_location_id = diz AND hm % 7 IN (1, 2));
          st := '09:00'; en := '15:00'; brk := 0;
        ELSE
          CONTINUE WHEN extract(dow FROM d) = off_day;
          IF extract(dow FROM d) = 5 THEN
            st := '07:00'; en := '14:00'; brk := 0;
          ELSE
            morning := (hm + (d - ws)) % 2 = 0 OR m.id = dana;
            IF m.pos = 'אחראי/ת משמרת' THEN
              st := CASE WHEN morning THEN '06:30'::time ELSE '14:00'::time END;
              en := CASE WHEN morning THEN '14:30'::time ELSE '22:00'::time END;
            ELSE
              st := CASE WHEN morning THEN '07:00'::time ELSE '14:00'::time END;
              en := CASE WHEN morning THEN '15:00'::time ELSE '22:00'::time END;
            END IF;
            brk := 30;
          END IF;
        END IF;
      END IF;
      INSERT INTO ritmo.shifts (org_id, location_id, position_id, member_id, starts_at, ends_at, break_minutes,
                                status, published_at, created_by)
      VALUES (p_org, m.primary_location_id, m.position_id, m.id, ritmo.demo_at(d, st), ritmo.demo_at(d, en), brk,
              CASE WHEN d < ws + 7 THEN 'published' ELSE 'draft' END,
              CASE WHEN d < ws + 7 THEN ritmo.demo_at(ws - 3, '12:00') END, owner_id);
    END LOOP;
  END LOOP;

  -- Open shifts: Thursday evening at Dizengoff (two spots, bonus), Saturday at Ramat HaHayal,
  -- and one in next week's draft.
  INSERT INTO ritmo.shifts (org_id, location_id, position_id, member_id, starts_at, ends_at, status, open_bonus_minor,
                            published_at, created_by, notes)
  VALUES
    (p_org, diz, barista, NULL, ritmo.demo_at(ws + 4, '18:00'), ritmo.demo_at(ws + 4, '23:00'), 'published', 24000,
     ritmo.demo_at(ws - 3, '12:00'), owner_id, 'ערב הופעה ברחוב'),
    (p_org, diz, barista, NULL, ritmo.demo_at(ws + 4, '18:00'), ritmo.demo_at(ws + 4, '23:00'), 'published', 24000,
     ritmo.demo_at(ws - 3, '12:00'), owner_id, 'ערב הופעה ברחוב'),
    (p_org, ramat, barista, NULL, ritmo.demo_at(ws + 6, '09:00'), ritmo.demo_at(ws + 6, '17:00'), 'published', NULL,
     ritmo.demo_at(ws - 3, '12:00'), owner_id, 'תוספת שבת'),
    (p_org, haifa, barista, NULL, ritmo.demo_at(ws + 8, '07:00'), ritmo.demo_at(ws + 8, '15:00'), 'draft', NULL,
     NULL, owner_id, NULL);

  -- Play every past day in full, and today up to now.
  FOR d IN SELECT generate_series(ws - 14, today - 1, interval '1 day')::date LOOP
    PERFORM ritmo.demo_simulate(p_org, d, ritmo.demo_at(d + 1, '06:00'));
  END LOOP;
  PERFORM ritmo.demo_simulate(p_org, today, now());

  -- Timesheets: everything before last week approved; last week has 9 waiting.
  INSERT INTO ritmo.timesheet_approvals (org_id, member_id, week_start, status, totals, decided_by, decided_at)
  SELECT DISTINCT p_org, te.member_id, ws - 14, 'approved', '{"source": "demo"}'::jsonb, owner_id, ritmo.demo_at(ws - 7, '10:00')
  FROM ritmo.time_entries te WHERE te.org_id = p_org AND te.work_date >= ws - 14 AND te.work_date < ws - 7
    AND te.member_id <> owner_id;
  INSERT INTO ritmo.timesheet_approvals (org_id, member_id, week_start, status, totals, decided_by, decided_at)
  SELECT p_org, x.member_id, ws - 7, 'approved', '{"source": "demo"}'::jsonb, owner_id, ritmo.demo_at(ws, '10:00')
  FROM (SELECT DISTINCT member_id FROM ritmo.time_entries
        WHERE org_id = p_org AND work_date >= ws - 7 AND work_date < ws AND member_id <> owner_id) x
  ORDER BY ritmo.demo_hash(x.member_id::text)
  OFFSET 9;

  -- Dana asks Omer to take her next shift.
  SELECT id INTO next_shift FROM ritmo.shifts
    WHERE member_id = dana AND status = 'published' AND starts_at > now() ORDER BY starts_at LIMIT 1;
  IF next_shift IS NOT NULL AND omer IS NOT NULL THEN
    INSERT INTO ritmo.shift_requests (org_id, kind, shift_id, requester_member_id, target_member_id, note)
    VALUES (p_org, 'swap', next_shift, dana, omer, 'יש לי מבחן באוניברסיטה');
  END IF;

  UPDATE ritmo.organizations SET demo_built_on = today, demo_ticked_at = now() WHERE id = p_org;
END $$;

-- ------------------------------------------------------------
-- Called by the app on page load (as the signed-in user).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION ritmo.demo_refresh(p_org uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ritmo, pg_temp AS $$
DECLARE
  o ritmo.organizations;
  claims text := current_setting('request.jwt.claims', true);
BEGIN
  SELECT * INTO o FROM ritmo.organizations WHERE id = p_org;
  IF NOT FOUND OR NOT o.is_demo OR NOT ritmo.is_member(p_org) THEN RETURN; END IF;
  -- Serialize concurrent refreshes of the same demo org.
  PERFORM pg_advisory_xact_lock(ritmo.demo_hash(p_org::text));
  SELECT * INTO o FROM ritmo.organizations WHERE id = p_org;
  -- The simulation acts as "the system", not as the visitor.
  PERFORM set_config('request.jwt.claims', '', true);
  IF o.demo_built_on IS DISTINCT FROM ritmo.demo_today() THEN
    PERFORM ritmo.demo_build(p_org);
  ELSIF o.demo_ticked_at IS NULL OR o.demo_ticked_at < now() - interval '1 minute' THEN
    PERFORM ritmo.demo_simulate(p_org, ritmo.demo_today(), now());
    UPDATE ritmo.organizations SET demo_ticked_at = now() WHERE id = p_org;
  END IF;
  PERFORM set_config('request.jwt.claims', coalesce(claims, ''), true);
END $$;

-- ------------------------------------------------------------
-- One-time creation of the demo company. Safe to run again.
-- Demo password for all four logins: ritmo-demo
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION ritmo.seed_demo() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ritmo, pg_temp AS $$
DECLARE
  v_org uuid;
  pw constant text := 'scrypt$16384$8$1$gr1sF4aHaZEoc/LX6eFpIg==$ZegRTWEqlZcp+xKYWHMTvpf7yeF+LP1Aydjkm0Y3KJvviYN/GBnxOtNCYaAWKAk3ptYLhb4ptr0mfjHyWzXwIA==';
  loc record;
  r record;
  n integer := 0;
  v_member uuid;
  v_conv uuid;
  michal uuid;
  omer uuid;
  dana uuid;
BEGIN
  SELECT id INTO v_org FROM ritmo.organizations WHERE slug = 'cafe-alma';
  IF v_org IS NOT NULL THEN
    PERFORM ritmo.demo_build(v_org);
    RETURN v_org;
  END IF;

  INSERT INTO ritmo_auth.users (id, email, password_hash, full_name, locale) VALUES
    ('a1000000-0000-4000-8000-000000000001', 'michal@cafe-alma.test', pw, 'מיכל כהן', 'he'),
    ('a1000000-0000-4000-8000-000000000002', 'omer@cafe-alma.test', pw, 'עומר כץ', 'he'),
    ('a1000000-0000-4000-8000-000000000003', 'dana@cafe-alma.test', pw, 'דנה לוי', 'he'),
    ('a1000000-0000-4000-8000-000000000004', 'shiran@cafe-alma.test', pw, 'שירן אבוטבול', 'he')
  ON CONFLICT (email) DO NOTHING;

  INSERT INTO ritmo.organizations (name, slug, locale, is_demo) VALUES ('קפה אלמה', 'cafe-alma', 'he', true)
    RETURNING id INTO v_org;

  INSERT INTO ritmo.locations (org_id, name, kind, address, lat, lng, geofence_radius_m, weekly_budget_minor, sort_order) VALUES
    (v_org, 'דיזנגוף', 'branch', 'דיזנגוף 180, תל אביב', 32.0809, 34.7745, 120, 1600000, 1),
    (v_org, 'חיפה', 'branch', 'שדרות הנשיא 120, חיפה', 32.8143, 34.9889, 150, 1350000, 2),
    (v_org, 'רמת החייל', 'branch', 'הברזל 30, תל אביב', 32.1098, 34.8394, 150, 1250000, 3),
    (v_org, 'משרד', 'office', 'הארבעה 21, תל אביב', 32.0712, 34.7865, 100, NULL, 4);

  INSERT INTO ritmo.positions (org_id, name, color, sort_order) VALUES
    (v_org, 'בריסטה', 'green', 1),
    (v_org, 'אחראי/ת משמרת', 'sun', 2),
    (v_org, 'קופה', 'sky', 3),
    (v_org, 'מחסן', 'clay', 4),
    (v_org, 'משרד', 'stone', 5);

  FOR r IN
    SELECT * FROM (VALUES
      -- first, last, position, location, role, works_on, rate (agorot/h), contract hours, title, user id
      ('מיכל', 'כהן', 'משרד', 'משרד', 'owner', 'both', 9000, 42, 'מנהלת תפעול', 'a1000000-0000-4000-8000-000000000001'),
      ('עומר', 'כץ', 'אחראי/ת משמרת', 'דיזנגוף', 'manager', 'site', 5800, 42, 'אחראי משמרת', 'a1000000-0000-4000-8000-000000000002'),
      ('דנה', 'לוי', 'בריסטה', 'דיזנגוף', 'employee', 'site', 4900, 36, NULL, 'a1000000-0000-4000-8000-000000000003'),
      ('שירן', 'אבוטבול', 'משרד', 'משרד', 'employee', 'computer', 7200, 42, 'הנהלת חשבונות', 'a1000000-0000-4000-8000-000000000004'),
      ('אור', 'שלום', 'בריסטה', 'דיזנגוף', 'employee', 'site', 4600, 36, NULL, NULL),
      ('יעל', 'ברק', 'בריסטה', 'דיזנגוף', 'employee', 'site', 4600, 30, NULL, NULL),
      ('איתי', 'גולן', 'קופה', 'דיזנגוף', 'employee', 'site', 4400, 36, NULL, NULL),
      ('מאיה', 'רוזן', 'בריסטה', 'דיזנגוף', 'employee', 'site', 4700, 42, NULL, NULL),
      ('נתן', 'אלמוג', 'מחסן', 'דיזנגוף', 'employee', 'site', 4800, 42, NULL, NULL),
      ('הילה', 'דהן', 'קופה', 'דיזנגוף', 'employee', 'site', 4400, 30, NULL, NULL),
      ('רועי', 'סגל', 'בריסטה', 'דיזנגוף', 'employee', 'site', 4600, 36, NULL, NULL),
      ('שני', 'פרץ', 'בריסטה', 'דיזנגוף', 'employee', 'site', 4600, 30, NULL, NULL),
      ('גיא', 'אדלר', 'מחסן', 'דיזנגוף', 'employee', 'site', 4800, 42, NULL, NULL),
      ('תמר', 'נחום', 'קופה', 'דיזנגוף', 'employee', 'site', 4400, 36, NULL, NULL),
      ('עידו', 'שפירא', 'בריסטה', 'דיזנגוף', 'employee', 'site', 4600, 36, NULL, NULL),
      ('ליה', 'מור', 'אחראי/ת משמרת', 'דיזנגוף', 'employee', 'site', 5500, 42, 'אחראית משמרת', NULL),
      ('נועה', 'בן דוד', 'קופה', 'חיפה', 'employee', 'site', 4400, 36, NULL, NULL),
      ('יוסי', 'מזרחי', 'מחסן', 'חיפה', 'employee', 'site', 4800, 42, NULL, NULL),
      ('אלון', 'חדד', 'אחראי/ת משמרת', 'חיפה', 'manager', 'site', 5800, 42, 'מנהל סניף', NULL),
      ('שירה', 'ביטון', 'בריסטה', 'חיפה', 'employee', 'site', 4600, 36, NULL, NULL),
      ('דניאל', 'עזרא', 'בריסטה', 'חיפה', 'employee', 'site', 4600, 42, NULL, NULL),
      ('מירב', 'אסולין', 'קופה', 'חיפה', 'employee', 'site', 4400, 30, NULL, NULL),
      ('עמית', 'קורן', 'בריסטה', 'חיפה', 'employee', 'site', 4600, 36, NULL, NULL),
      ('אדי', 'לוי', 'מחסן', 'חיפה', 'employee', 'site', 4800, 42, NULL, NULL),
      ('רותם', 'חזן', 'בריסטה', 'חיפה', 'employee', 'site', 4600, 36, NULL, NULL),
      ('יובל', 'שגיא', 'קופה', 'חיפה', 'employee', 'site', 4400, 36, NULL, NULL),
      ('סהר', 'מלכה', 'בריסטה', 'חיפה', 'employee', 'site', 4600, 30, NULL, NULL),
      ('אנה', 'קוגן', 'בריסטה', 'חיפה', 'employee', 'site', 4600, 36, NULL, NULL),
      ('אביב', 'שרעבי', 'בריסטה', 'רמת החייל', 'employee', 'site', 4600, 42, NULL, NULL),
      ('נוי', 'אוחיון', 'אחראי/ת משמרת', 'רמת החייל', 'employee', 'site', 5500, 42, 'אחראית משמרת', NULL),
      ('אריאל', 'וקנין', 'בריסטה', 'רמת החייל', 'employee', 'site', 4600, 36, NULL, NULL),
      ('ליאור', 'טל', 'קופה', 'רמת החייל', 'employee', 'site', 4400, 36, NULL, NULL),
      ('הדר', 'בכר', 'בריסטה', 'רמת החייל', 'employee', 'site', 4600, 30, NULL, NULL),
      ('אסף', 'ברגר', 'מחסן', 'רמת החייל', 'employee', 'site', 4800, 42, NULL, NULL),
      ('קרן', 'אילוז', 'בריסטה', 'רמת החייל', 'employee', 'site', 4600, 36, NULL, NULL),
      ('מתן', 'רוט', 'קופה', 'רמת החייל', 'employee', 'site', 4400, 30, NULL, NULL),
      ('עדי', 'פרלמן', 'בריסטה', 'רמת החייל', 'employee', 'site', 4600, 36, NULL, NULL),
      ('בן', 'חסון', 'בריסטה', 'רמת החייל', 'employee', 'site', 4600, 36, NULL, NULL),
      ('ספיר', 'עמר', 'קופה', 'רמת החייל', 'employee', 'site', 4400, 36, NULL, NULL),
      ('רון', 'גבאי', 'משרד', 'משרד', 'employee', 'computer', 7800, 42, 'רכש', NULL),
      ('ליאת', 'אוחנה', 'משרד', 'משרד', 'employee', 'computer', 7000, 42, 'שיווק', NULL),
      ('תום', 'פרידמן', 'משרד', 'משרד', 'employee', 'computer', 6800, 42, 'משאבי אנוש', NULL)
    ) AS t(first_name, last_name, pos, loc, role, works_on, rate, hours, title, user_id)
  LOOP
    n := n + 1;
    INSERT INTO ritmo.members (org_id, user_id, first_name, last_name, email, employee_no, role, title, position_id,
                               primary_location_id, works_on, contract_hours_week, avatar_color, status)
    SELECT v_org, r.user_id::uuid, r.first_name, r.last_name,
           (SELECT email FROM ritmo_auth.users WHERE id = r.user_id::uuid),
           (1000 + n)::text, r.role, coalesce(r.title, r.pos),
           (SELECT id FROM ritmo.positions WHERE org_id = v_org AND name = r.pos),
           (SELECT id FROM ritmo.locations WHERE org_id = v_org AND name = r.loc),
           r.works_on, r.hours, (ARRAY['green', 'sun', 'sky', 'clay', 'stone'])[1 + n % 5], 'active'
    RETURNING id INTO v_member;
    INSERT INTO ritmo.member_pay (org_id, member_id, hourly_rate_minor) VALUES (v_org, v_member, r.rate);
    IF r.role = 'owner' THEN
      INSERT INTO ritmo.member_locations (org_id, member_id, location_id)
      SELECT v_org, v_member, id FROM ritmo.locations WHERE org_id = v_org;
    ELSE
      INSERT INTO ritmo.member_locations (org_id, member_id, location_id)
      SELECT v_org, v_member, id FROM ritmo.locations WHERE org_id = v_org AND name = r.loc;
    END IF;
  END LOOP;

  SELECT id INTO michal FROM ritmo.members WHERE org_id = v_org AND role = 'owner';
  SELECT id INTO omer FROM ritmo.members WHERE org_id = v_org AND email = 'omer@cafe-alma.test';
  SELECT id INTO dana FROM ritmo.members WHERE org_id = v_org AND email = 'dana@cafe-alma.test';

  -- Chat: one channel for everyone, one per branch.
  INSERT INTO ritmo.conversations (org_id, kind, name, created_by) VALUES (v_org, 'channel', 'כל הצוות', michal)
    RETURNING id INTO v_conv;
  INSERT INTO ritmo.conversation_members (org_id, conversation_id, member_id, last_read_at)
    SELECT v_org, v_conv, id, now() - interval '2 days' FROM ritmo.members WHERE org_id = v_org;
  INSERT INTO ritmo.messages (org_id, conversation_id, sender_member_id, body, created_at) VALUES
    (v_org, v_conv, michal, 'בוקר טוב לכולם. מחר נכנס תפריט הסתיו, תעברו על המתכונים החדשים לפני המשמרת.', now() - interval '26 hours'),
    (v_org, v_conv, michal, 'תזכורת: דיווחי השעות של השבוע הקודם נסגרים ביום ראשון ב־12:00.', now() - interval '3 hours');

  FOR loc IN SELECT * FROM ritmo.locations WHERE org_id = v_org AND kind = 'branch' LOOP
    INSERT INTO ritmo.conversations (org_id, kind, name, location_id, created_by)
      VALUES (v_org, 'channel', 'צוות ' || loc.name, loc.id, michal) RETURNING id INTO v_conv;
    INSERT INTO ritmo.conversation_members (org_id, conversation_id, member_id, last_read_at)
      SELECT DISTINCT v_org, v_conv, ml.member_id, now() - interval '1 day'
      FROM ritmo.member_locations ml WHERE ml.location_id = loc.id;
    IF loc.name = 'דיזנגוף' THEN
      INSERT INTO ritmo.messages (org_id, conversation_id, sender_member_id, body, created_at) VALUES
        (v_org, v_conv, omer, 'מכונת הקפה השנייה חזרה מתיקון, אפשר לעבוד על שתיהן.', now() - interval '5 hours'),
        (v_org, v_conv, dana, 'מעולה, תודה. חלב השקדים נגמר במחסן, להזמין?', now() - interval '4 hours'),
        (v_org, v_conv, omer, 'כן, הזמנתי. מגיע מחר בבוקר.', now() - interval '4 hours' + interval '6 minutes');
    END IF;
  END LOOP;

  PERFORM ritmo.demo_build(v_org);
  RETURN v_org;
END $$;

REVOKE ALL ON FUNCTION ritmo.demo_simulate(uuid, date, timestamptz), ritmo.demo_build(uuid), ritmo.seed_demo() FROM PUBLIC, ritmo_user;
GRANT EXECUTE ON FUNCTION ritmo.demo_refresh(uuid) TO ritmo_user;
