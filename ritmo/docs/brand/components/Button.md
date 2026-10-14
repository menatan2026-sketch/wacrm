# Button

Buttons trigger one action. Six intents, three sizes, one focus treatment.

**Markup.** `<button class="rt-btn rt-btn--{primary|pulse|secondary|ghost|link|danger} [rt-btn--sm|rt-btn--lg] [rt-btn--icon]">`. An optional 16px icon goes first in the DOM, so it leads in both directions.

- `primary`: the main action of a view. One per view.
- `pulse`: only the "start the clock" moment (clock in, start tracking). Never more than one on screen.
- `secondary`: neutral actions next to a primary; toolbars.
- `ghost`: tertiary actions, dismissals ("Not now", "Cancel").
- `link`: inline navigation inside text or panel footers.
- `danger`: destructive actions, always behind a confirmation dialog.

**Sizes.** `sm` 28px (tables, panel headers), default 36px (web), `lg` 48px (mobile primary actions, the clock). Icon-only buttons need `aria-label`.

**Motion.** Press scales to 0.97 in 120ms (pointer only); hover changes color in 120ms. No ripples, no glows.

**Copy.** Verb first, sentence case, 1–3 words: "Approve", "Export to payroll", "אישור", "ייצוא לשכר". Never "Click here", "OK" or "Submit".
