# ClockCard

The hero of the employee app: the running timer and the one-tap clock in/out.

**Markup.** `.rt-clockcard` (on `hero`, text `on-hero`) with `.rt-clockcard__meta` (label, `.rt-clockcard__timer`) and `<button class="rt-clock [rt-clock--stop]">`. On mobile, use a full-width `rt-btn--pulse rt-btn--lg` instead of the round button.

- Not clocked in: `pulse` fill, "Clock in" / "כניסה". Clocked in: `beat` fill, "Clock out" / "יציאה".
- The timer is the only IBM Plex Mono element on screen.
- The label says where and since when; add geofence state ("Inside the branch area · 8 m accuracy").
- Clock in must be reachable in ≤ 2 taps from launch.
- Motion (signature): press 0.97 → one lime ring expands (600ms, once) → fill crossfades to amber (200ms) → timer rises 8px. Haptic: success. Reduced motion: instant swap, haptic only.
