# StatusPill

A tinted 22px badge for a single emphasized state, plus `rt-count` for counters.

**Markup.** `<span class="rt-pill rt-pill--{on|live|break|pending|late|off} [rt-pill--plain]">`, `<span class="rt-count [rt-count--beat]">`.

- Use on mobile cards, in headers next to a title, or once per panel. In tables use **Status** instead.
- `rt-pill--plain` drops the dot for labels like "New".
- `rt-count--beat` (amber) is for counts that need action (pending approvals); plain counts are neutral.
- Radius is `radius-sm`, not a full pill: the pill shape belongs to the mark and status dots.
