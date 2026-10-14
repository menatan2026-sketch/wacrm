# Reference screens

Static HTML built only from `design/tokens.css`, `design/components.css` and `design/motion.css` (+ `screens.css` for page layout). Open them in a browser: they follow the system theme, or add `data-theme="dark"` to `<html>`. Light and dark captures are in `screenshots/`.

They are **references for layout, hierarchy, density, copy and motion**, not code to ship. Rebuild them as real components in the app's stack and keep what's listed under "Preserve".

## 01 — Manager overview (web, Hebrew, RTL)
`01-manager-dashboard.html` · Phase 1

- **Frame:** sidebar on the canvas (workspace switcher, nav with counts, user at the bottom); all content on one raised sheet with a 52px bar (breadcrumbs, ⌘K search, "Ask Ritmo", notifications).
- **Head:** page title "סקירה" + date and scope, branch segmented control, "Export to payroll" and "New shift" (the one primary).
- **Stat strip:** on shift now (with 7-day sparkline), hours this week (+6%), overtime (+18%, warning sparkline), weekly payroll against budget (meter).
- **On shift now:** a real table (person, role, branch, clock-in, hours today, status as dot + word) with filter tabs and counts, 6 rows + "6 of 37" footer link.
- **Needs you:** one work list. Ritmo's AI suggestion is the first item, labelled "Ritmo suggests", with the same controls as the rest (preview changes / not now). Swap approval inline, out-of-geofence check, timesheet batch.
- **Computer activity today:** one 8px timeline per person with totals, a breathing TrackingIndicator, legend with hatched idle.

**Preserve:** one sheet, hairlines, no floating cards; every number has a comparison; AI is a work item, not a glowing box; times isolated as LTR inside Hebrew.

## 02 — Weekly schedule (web, Hebrew, RTL)
`02-weekly-schedule.html` · Phase 1 (basic), Phase 3 (full)

- Title "שבוע 42", date range, branch, and the draft status as a Status ("Draft, not published").
- Toolbar: previous / Today / next (arrows mirror in RTL), view segmented control, "Auto-schedule" (previews before applying), "Publish to employees" (primary).
- Stat strip: planned cost vs budget (meter), scheduled vs contracted hours, coverage, issues to fix.
- Grid: Sunday-first week, today's column softly tinted, compact rows with each person's scheduled/contracted hours as a mini meter (amber when over), ShiftBlocks tinted by role, inline flags (pending swap, conflict with approved vacation), an open-shifts row with outlined, hatched blocks.
- Footer: role legend and "Saved automatically 3 min ago · drag with mouse or arrow keys".

**Preserve:** tint = role only; publishing is explicit; drag with keyboard alternative; autosave stated.

## 03 — Employee app (iOS/Android, Hebrew, RTL)
`03-employee-mobile.html` · Phase 1 (clock), Phase 3 (full)

1. **Today, before the shift:** greeting, dark clock card with shift, geofence accuracy and the screen's only lime button. **Click it** to see the clock-in choreography. Tasks as a grouped list, one must-read update.
2. **On shift:** running timer, today's work/break bar, "Break" and amber "Clock out", week-to-date hours, estimated pay and vacation balance as a grouped list.
3. **Shifts:** segmented mine/open, Sunday-first day picker with dots, the selected shift with teammates and actions, matching open shifts with bonus and spots, swap status as a warning banner.

**Preserve:** clock in ≤ 2 taps; 48px primary buttons; grouped lists instead of stacked cards; tab bar of 5.

## 04 — Desktop tracking (agent + "What's collected", English, LTR)
`04-desktop-tracking.html` · Phase 2

- **Agent popover (360px):** tracking chip in the title bar, timer with Pause, project picker, today's timeline with totals, the idle question with "Personal · not tracked", footer "Work hours only · What's collected".
- **"What Ritmo collects about you":** a document page: collected vs never collected, "your apps today, as your manager sees them", retention with download and correction.

**Preserve:** the agent never hides; idle is asked about, never assumed unproductive; the employee sees exactly what the manager sees.

## 05 — States & motion (interactive board, English, LTR)
`05-states-and-motion.html` · All phases

Clickable demos of every choreography in `docs/brand/MOTION.md` and every system state: clock in, inline approve + undo toast, list enter, skeleton, rhythm loader, empty state, error/offline/info banners, live dot, number change, menu, segmented indicator, dialog. Turn on "Reduce motion" in the OS to see the fallbacks.

**Preserve:** these timings and easings exactly; every state has a designed version before a feature ships.
