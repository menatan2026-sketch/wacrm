# Field

A labeled text input with a hint that becomes the error message.

**Markup.** `<label class="rt-field [rt-field--error]">` with `.rt-field__label`, `<input class="rt-input">` and `.rt-field__hint`. Add `rt-num` to inputs for times, amounts and IDs.

- Label always visible, above the input, sentence case. Placeholders show an example, never the label.
- Error: add `rt-field--error`, set `aria-invalid="true"`, and rewrite the hint to say how to fix it.
- 36px tall on web, 44px on mobile. Border `line-strong` (3:1). Focus: border turns `focus-ring` with a 3px `brand-tint` halo, 120ms.
- Validate on blur, not on every keystroke.
