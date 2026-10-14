# StatStrip

Headline numbers in one hairline-divided strip. Replaces rows of floating metric cards.

**Markup.** `<section class="rt-stats" style="--cols:4">` with `.rt-stat` children: `.rt-stat__label`, `.rt-stat__row` (value + optional `.rt-spark` or nothing), optional `.rt-meter`, `.rt-stat__delta`.

- 3–5 stats per strip, one strip per page, at the top.
- Every number says what it is compared with ("vs last week", "of 42 scheduled", "of ₪42,000"). No comparison, no delta line.
- Sparkline: last 7 points, the latest bar in `brand` (or `beat` for a warning). Meter: progress against a budget or capacity.
- Units go small inside the value (`46<small> h</small>`). Numbers are sans with tabular digits.
- Values update with the Number change motion (6px slide in the direction of change, 200ms); never count up.
