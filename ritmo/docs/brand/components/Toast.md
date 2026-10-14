# Toast

Short confirmation after an action, with Undo when the action can be reversed.

**Markup.** `<div class="rt-toast" role="status">` with a 16px check icon, a past-tense sentence, and an optional `<button>` (Undo).

- Appears at the block-end corner (bottom-start on web, above the tab bar on mobile). 5s, paused on hover/focus.
- Past tense, specific: "Swap approved", "Published to 42 people". No "Success!".
- Errors are not toasts; use a Banner or the field error.
- Motion: rises 16px with scale 0.98 → 1 in 260ms; leaves in 120ms.
