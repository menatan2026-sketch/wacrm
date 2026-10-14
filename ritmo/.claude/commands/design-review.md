---
description: Audit the current UI against the Ritmo brand and design system
argument-hint: [path or screen to review — optional]
---
Review $ARGUMENTS (if no argument was given, review the UI code changed in this branch) against Ritmo's design system. Read `CLAUDE.md`, `docs/brand/BRAND.md`, `design/tokens.json` and the closest reference screen in `docs/screens/` first.

Check and report each finding with file:line and a concrete fix:
- Hard-coded colors, sizes, radii, shadows or fonts that should be tokens (or Tailwind utilities from `design/tailwind-theme.css`).
- `left`/`right` instead of logical properties; numbers, times, ranges or currency inside Hebrew text not wrapped in `<bdi>`/`.rt-num`.
- More than one `pulse` (lime) element on a screen, or `pulse` used for anything but starting the clock / the live dot.
- Status shown by color alone; text on fills not using `on-*` tokens; contrast below 4.5:1 (text) or 3:1 (controls, focus) in either theme.
- Missing light or dark theme handling, focus ring, keyboard support, 44px touch targets, `prefers-reduced-motion`.
- Missing loading / empty / error states.
- Anything on the "What Ritmo never looks like" list in BRAND.md (floating metric cards, card soup, giant greetings, gradients, sparkle-AI boxes, tinted badges on every row).
- Motion off-spec (MOTION.md): durations outside the tokens, bounce/elastic easing, animating layout properties, no reduced-motion fallback, non-interruptible animations, clock-in choreography not matching the spec.
- Copy that breaks the voice rules (exclamation marks, emoji, "monitoring", vague errors, non-neutral Hebrew gender).
- Any desktop-tracking UI that hides tracking, collects beyond the rules, or lacks the link to "What's collected".

Group findings as Must fix / Should fix / Nice to have. Then ask whether to apply the Must-fix items.
