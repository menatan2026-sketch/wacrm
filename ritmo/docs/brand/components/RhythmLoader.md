# RhythmLoader

Ritmo's only spinner: the mark's three bars keep time. Plus the skeleton for loading content.

**Markup.** `<span class="rt-loader"><i></i><i></i><i></i></span>` (width sets the size; color is `brand`), and `class="m-skeleton"` on placeholder shapes.

- Use the loader for AI work and jobs longer than ~1s, always with a sentence saying what is happening.
- Use skeletons for content areas, shown only if loading exceeds 300ms; match the real layout's shapes.
- Never a generic circular spinner. Never a loader without a label.
