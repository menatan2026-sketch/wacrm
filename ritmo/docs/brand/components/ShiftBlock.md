# ShiftBlock

One shift on the schedule grid: time and role.

**Markup.** `<div class="rt-shift rt-shift--{green|sun|sky|clay|stone|open}" tabindex="0">` with `.rt-shift__time` and `.rt-shift__who` (optional `.rt-shift__role`). Add `.is-dragging` while dragging.

- Tint encodes **role**, in the order `shift-green`, `shift-sun`, `shift-sky`, `shift-clay`, `shift-stone`, with a legend. Never encode status by tint: put a flag under the block ("Pending swap", "Approved vacation").
- `open` = unassigned shift that employees can claim (outlined, hatched).
- Text is `ink` on every tint in both themes. Time first, 24-hour.
- Motion: pickup scale 1.02 + `shadow-md`; drop snaps on the snappy spring; keyboard moves (arrows after Enter) are instant.
