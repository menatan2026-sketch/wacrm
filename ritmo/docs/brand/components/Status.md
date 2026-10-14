# Status

A 6px dot and a word: the default way to show state in tables and dense lists.

**Markup.** `<span class="rt-status rt-status--{on|live|break|pending|late|off}">Label</span>`.

- Use in every table row and list item. Tinted badges on every row are noise; the dot plus word scans faster.
- `late` and `pending` also color the word (danger / warning); the others keep `ink` text so the column stays calm.
- Include the amount when it matters: "Late 14 min", "On break · 12 min".
- Never color alone: the word is required.
