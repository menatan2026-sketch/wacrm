# Table

The default container for people, shifts, timesheets and anything with more than three attributes.

**Markup.** `<table class="rt-table">`; numeric cells and headers get `class="num"` (end-aligned); people use `.rt-person` (avatar + name + secondary line). Rows that open something get `tabindex="0"`.

- Row height 40–44px. Hairline dividers only; no zebra stripes, no vertical borders.
- Secondary columns in `ink-muted`; one bold element per row (the name).
- State column uses **Status**, never tinted badges.
- Hover tints the row in 120ms. Sorting is instant; first load uses the List enter stagger.
- Show at most ~8 rows in a dashboard panel with a footer link to the full list.
