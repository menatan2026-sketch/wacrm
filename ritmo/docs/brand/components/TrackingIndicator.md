# TrackingIndicator

The always-visible transparency chip for desktop tracking: Ritmo never tracks silently.

**Markup.** `<span class="rt-tracking [rt-tracking--paused]">` with `.rt-tracking__live` (add `m-live` for the breathing dot), a bold state word plus scope, and a link to the employee's data page.

- Shown in the agent window, the web app bar while the agent runs, and mirrored by the tray/menu-bar icon.
- States: on (green, breathing) and paused (amber, static). There is no hidden state.
- The link always goes to "What's collected about me": "What's collected" / "מה נאסף עליי?".
