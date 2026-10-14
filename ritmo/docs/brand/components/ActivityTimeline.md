# ActivityTimeline

A day of work as one bar: focused, neutral, idle and break segments.

**Markup.** `.rt-track [rt-track--lg]` with `.rt-track__bar` of `.rt-track__seg--{focus|neutral|idle|break}` sized by `flex: <minutes>`, `.rt-track__axis`, `.rt-legend` (use `<i class="hatch">` for idle).

- Idle is always hatched; the four states never rely on color alone.
- The bar gets an `aria-label` with totals in words.
- In lists (one row per person), use the 8px bar with name and total columns.
- The employee sees exactly the same timeline as the manager. App and site names appear only if company policy enables them and employees were notified.
- Motion: the live segment grows with `scaleX` from the inline-start edge (360ms) once a minute.
