# 05 · Screen map

Legend: **P1…P5** = phase in which the screen ships. Roles: **O** owner,
**A** admin, **M** manager (scoped), **E** employee, **C** contractor/guest.
Every screen ships with designed loading (skeleton), empty, error and
no-permission states, and in he-RTL / en-LTR × light/dark.

## 1. Web app (`apps/web`)

### Public & onboarding

| ID   | Screen                                                                                                                                                                                                  | Phase       | Roles |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----- |
| W-01 | Sign in (email, phone OTP, magic link, Google, Microsoft, SSO by domain)                                                                                                                                | P1 (SSO P5) | all   |
| W-02 | Sign up → create organization                                                                                                                                                                           | P1          | —     |
| W-03 | Accept invite (email / SMS / WhatsApp link)                                                                                                                                                             | P1          | all   |
| W-04 | **Setup wizard** (≤ 10 min): company details → locations (map, geofence) → import or invite people → pick attendance preset (IL / custom) → first schedule template → done (checklist persists on Home) | P1          | O     |
| W-05 | 2FA enrollment / challenge                                                                                                                                                                              | P1          | all   |
| W-06 | Org switcher (multi-org users)                                                                                                                                                                          | P1          | all   |

### Home

| ID   | Screen                                                                                                                                                    | Phase | Roles |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| W-10 | **Manager / exec dashboard**: who's on shift now (live), late/absent, open shifts, pending approvals, hours and labor cost vs budget this week, anomalies | P1    | O A M |
| W-11 | Setup checklist (until complete)                                                                                                                          | P1    | O A   |
| W-12 | Employee web home: clock button, next shift, my hours this week                                                                                           | P1    | E C   |
| W-13 | AI insights strip + ask bar ("why was overtime up…")                                                                                                      | P4    | O A M |

### People

| ID   | Screen                                                                                   | Phase                    | Roles                |
| ---- | ---------------------------------------------------------------------------------------- | ------------------------ | -------------------- |
| W-20 | Directory (table/grid, filters by location/department/team/position, saved views)        | P1                       | all (fields by perm) |
| W-21 | Employee profile: overview · employment · schedule · time · documents · activity · audit | P1 (tabs grow per phase) | O A M, self          |
| W-22 | Add / edit employee (incl. kiosk PIN, positions, locations, custom fields)               | P1                       | O A M                |
| W-23 | Bulk import (CSV/XLSX, column mapping, validation preview, dry run)                      | P1                       | O A                  |
| W-24 | Org chart                                                                                | P3                       | all                  |
| W-25 | Onboarding flows builder + runs                                                          | P3                       | O A                  |
| W-26 | Documents & expiry alerts                                                                | P3                       | O A M, self          |

### Time & attendance

| ID   | Screen                                                                                                       | Phase | Roles                     |
| ---- | ------------------------------------------------------------------------------------------------------------ | ----- | ------------------------- |
| W-30 | **Live attendance board** (map + list, real-time, geofence status)                                           | P1    | O A M                     |
| W-31 | Timesheets: period list → team grid (per member totals, OT tiers, anomaly badges)                            | P1    | O A M                     |
| W-32 | Timesheet detail: day rows, entries, breaks, evidence (events, GPS, photo), edit with reason, approve/reject | P1    | O A M, self (view/submit) |
| W-33 | Anomalies inbox (bulk resolve)                                                                               | P1    | O A M                     |
| W-34 | Payroll export: lock period → preview → export (CSV/XLSX; Hilan/Michpal formats P5) → history                | P1    | O A                       |
| W-35 | Job codes / projects / clients                                                                               | P1    | O A                       |
| W-36 | Time-off: requests, team calendar, balances, policies                                                        | P3    | all                       |

### Scheduling

| ID   | Screen                                                                                                                                                         | Phase | Roles |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| W-40 | **Scheduler**: week/day/month × by employee / position / location; drag-drop, copy week, templates, conflict and OT warnings inline, live labor cost vs budget | P1    | O A M |
| W-41 | Publish dialog: diff of changes + who gets notified (push / WhatsApp / email)                                                                                  | P1    | O A M |
| W-42 | Open shifts & requests queue (swap / drop / claim approvals)                                                                                                   | P1    | O A M |
| W-43 | Availability overview                                                                                                                                          | P1    | O A M |
| W-44 | Shift templates library                                                                                                                                        | P1    | O A M |
| W-45 | AI auto-schedule: constraints panel → proposal → explanation → apply/revert                                                                                    | P4    | O A M |
| W-46 | Calendar sync settings                                                                                                                                         | P5    | all   |

### Chat & communication

| ID   | Screen                                                                                             | Phase | Roles                       |
| ---- | -------------------------------------------------------------------------------------------------- | ----- | --------------------------- |
| W-50 | Chat: conversation list (DMs, groups, channels) + thread view + composer (files, voice notes P1.5) | P1    | all                         |
| W-51 | Channel settings / auto-membership rules                                                           | P1    | O A M                       |
| W-52 | Announcements feed + composer (targeting, schedule, mandatory read) + analytics                    | P3    | O A M (compose), all (read) |
| W-53 | Surveys / polls / pulse / suggestion box                                                           | P3    | all                         |
| W-54 | Events + RSVP                                                                                      | P3    | all                         |

### Work: tasks, jobs, forms

| ID   | Screen                                                             | Phase | Roles |
| ---- | ------------------------------------------------------------------ | ----- | ----- |
| W-60 | Tasks (kanban / list / calendar), recurring tasks, checklists      | P3    | all   |
| W-61 | Job dispatch board (map, routes, statuses), customers & sites      | P3    | O A M |
| W-62 | Form builder (conditional logic, signatures, photos, GPS, scoring) | P3    | O A M |
| W-63 | Form submissions + PDF reports + escalations                       | P3    | O A M |

### Computer activity (key differentiator)

| ID   | Screen                                                                                                                                | Phase | Roles                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------------------------------- |
| W-70 | **Unified timeline** (per person per day: scheduled · worked · desktop activity · idle · tasks)                                       | P2    | O A M, self                      |
| W-71 | Team productivity insights (focus time, context switching, meeting load, burnout signals, trends; team-level by default)              | P2    | O A M                            |
| W-72 | Apps & sites categories (per team/position rules)                                                                                     | P2    | O A                              |
| W-73 | Screenshots gallery (only if enabled; every view audited)                                                                             | P2    | perm `tracking.screenshots.view` |
| W-74 | Tracking policies + monitoring notice editor + acknowledgement status                                                                 | P2    | O A                              |
| W-75 | Devices (enrolled agents, versions, integrity events, revoke)                                                                         | P2    | O A                              |
| W-76 | **My privacy dashboard**: what is collected, live status, my screenshots (delete in grace window), who viewed my data, export my data | P2    | self                             |

### Learning, knowledge, HR extras

| ID   | Screen                                                                   | Phase | Roles                      |
| ---- | ------------------------------------------------------------------------ | ----- | -------------------------- |
| W-80 | Knowledge base + "Ask the handbook"                                      | P4    | all                        |
| W-81 | Courses: builder, AI course generator, quizzes, certifications           | P4    | O A M (build), all (learn) |
| W-82 | Expenses (receipt OCR), recognition & rewards, help desk, reviews & 1:1s | P3–P4 | all                        |

### Analytics & AI

| ID   | Screen                                                               | Phase             | Roles        |
| ---- | -------------------------------------------------------------------- | ----------------- | ------------ |
| W-90 | Report builder + scheduled reports + exports                         | P4                | O A M        |
| W-91 | AI assistant panel (global ⌘K / Ctrl+K: search, commands, questions) | P4 (⌘K search P1) | all (scoped) |
| W-92 | AI proposals history (apply / revert)                                | P4                | O A M        |

### Settings

| ID    | Screen                                                                         | Phase            | Roles     |
| ----- | ------------------------------------------------------------------------------ | ---------------- | --------- |
| W-100 | Organization (name, locale, timezone, week start, currency)                    | P1               | O A       |
| W-101 | Locations & geofences (map editor)                                             | P1               | O A       |
| W-102 | Departments, teams, positions                                                  | P1               | O A       |
| W-103 | Roles & permissions (matrix editor, scoped assignments, "view as")             | P1               | O         |
| W-104 | Attendance policies (preset + rule editor + "test against last month" preview) | P1               | O A       |
| W-105 | Kiosk devices (pair, revoke)                                                   | P1               | O A       |
| W-106 | Notifications (channels incl. WhatsApp, quiet hours)                           | P1               | O A, self |
| W-107 | Audit log viewer + export                                                      | P1               | O         |
| W-108 | Security: SSO, SCIM, 2FA enforcement, sessions                                 | P1 (2FA) / P5    | O         |
| W-109 | Integrations, API keys, webhooks                                               | P5 (API keys P1) | O A       |
| W-110 | Billing & plan                                                                 | P5               | O         |
| W-111 | Branding / white-label / custom domain                                         | P5               | O         |
| W-112 | AI settings (provider, region, per-module opt-out)                             | P4               | O         |
| W-113 | Data retention & privacy (per data class)                                      | P2               | O         |

## 2. Mobile app (`apps/mobile`)

Bottom tabs: **Home · Schedule · Chat · Tasks (P3) · More**. In RTL the tab
order mirrors.

| ID                      | Screen                                                                                                   | Phase | Notes                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------- |
| M-01                    | Sign in (phone OTP first, email, SSO)                                                                    | P1    |                                                                                    |
| M-02                    | Permissions primer (location, notifications)                                                             | P1    | Explains _why_ before the OS prompt                                                |
| M-10                    | **Home / Clock**: one giant clock button, current state, timer, next shift, geofence chip, offline badge | P1    | **Clock-in = 1 tap** (2 if a job code is required or the punch is out of geofence) |
| M-11                    | Break start/end, job switch sheet                                                                        | P1    |                                                                                    |
| M-12                    | Punch confirmation (haptic + animated check + "synced/queued")                                           | P1    |                                                                                    |
| M-13                    | Home-screen widget (iOS) / quick-settings tile (Android), Live Activity while on shift                   | P1.5  | **0 taps into the app**                                                            |
| M-20                    | My schedule (agenda + week strip)                                                                        | P1    |                                                                                    |
| M-21                    | Shift detail (location map, teammates, notes) → swap / drop                                              | P1    |                                                                                    |
| M-22                    | Open shifts marketplace (claim)                                                                          | P1    |                                                                                    |
| M-23                    | My availability editor                                                                                   | P1    |                                                                                    |
| M-30                    | Chat list + conversation + composer (photos, files; voice notes P1.5)                                    | P1    |                                                                                    |
| M-40                    | My timesheet (week, totals, flags, submit)                                                               | P1    |                                                                                    |
| M-41                    | Time-off: balances, request                                                                              | P3    |                                                                                    |
| M-50                    | Tasks, checklists, photo proof                                                                           | P3    |                                                                                    |
| M-51                    | Jobs (route, navigate, status, customer signature)                                                       | P3    |                                                                                    |
| M-52                    | Forms (fill, voice-to-form P4)                                                                           | P3    |                                                                                    |
| M-60                    | Announcements feed + mandatory read                                                                      | P3    |                                                                                    |
| M-70                    | Profile, documents, courses, recognition                                                                 | P3–P4 |                                                                                    |
| M-80                    | Notifications center                                                                                     | P1    |                                                                                    |
| M-90                    | Settings (language he/en, theme, notifications, privacy dashboard link)                                  | P1    |                                                                                    |
| **Manager mode**        |                                                                                                          |       |                                                                                    |
| M-100                   | Live board (who's in, late, absent)                                                                      | P1    |                                                                                    |
| M-101                   | Approvals inbox (timesheets, swaps, edits; swipe to approve)                                             | P1    |                                                                                    |
| M-102                   | Quick schedule edit (day view, assign open shift)                                                        | P1    |                                                                                    |
| M-103                   | AI assistant (voice or text)                                                                             | P4    |                                                                                    |
| **Kiosk mode** (tablet) |                                                                                                          |       |                                                                                    |
| K-01                    | Kiosk pairing (admin scans QR from W-105)                                                                | P1    |                                                                                    |
| K-02                    | Idle screen: clock, company logo, "tap your name / enter ID"                                             | P1    | Also ships as a web PWA (`/kiosk`)                                                 |
| K-03                    | Identify: search name / employee no. / badge QR                                                          | P1    |                                                                                    |
| K-04                    | PIN pad → optional photo snapshot → punch result (auto-return after 3 s)                                 | P1    | Face _match_ is P3+, opt-in (biometrics, see Q5)                                   |

## 3. Desktop agent (`apps/desktop`, Phase 2)

| ID   | Surface                                                                                                                 | Notes                              |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| D-01 | Tray / menu-bar icon with state (tracking · paused · off-clock · offline)                                               | Always visible; no stealth mode    |
| D-02 | Tray menu: clock in/out, pause (break), switch project/job, open window                                                 | Start/stop in 1 click              |
| D-03 | First-run: sign in → **monitoring notice** (must acknowledge) → OS permission primers                                   |                                    |
| D-04 | Main window: today timer, project picker, today's timeline                                                              | Created on demand                  |
| D-05 | Idle return prompt: "You were away 23 min, what was it?" (meeting, offline work → pick job, break, personal → excluded) |                                    |
| D-06 | Screenshot toast: thumbnail + "Delete" (within grace window)                                                            | Only if policy enables screenshots |
| D-07 | "What we collect": live view of exactly what's being recorded right now                                                 | Same data as W-76                  |
| D-08 | Update available / restart                                                                                              |                                    |

## 4. Key flows (designed first in Phase 1)

1. **First 10 minutes (owner):** W-02 → W-04 wizard → W-10 with checklist → invite sent over WhatsApp/SMS → first employee punches in from M-10.
2. **Clock in (employee, mobile):** unlock → open app → **tap** → haptic + confirmation. Offline: same, with "queued" chip; syncs silently later.
3. **Clock in (kiosk):** tap name → PIN → done (auto-return).
4. **Weekly scheduling (manager):** W-40 copy last week → fix conflicts flagged inline → watch cost vs budget → W-41 publish → employees notified → swaps arrive in W-42 / M-101.
5. **Pay period close (admin):** W-33 resolve anomalies → W-31 approve → W-34 lock + export.
6. **Desktop day (computer worker):** D-03 once → clock in from tray (or mobile, either source) → idle prompt after a meeting → W-70 unified timeline → W-76 sees exactly what was collected.
