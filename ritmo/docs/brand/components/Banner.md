# Banner

An inline message about the state of a page or the system.

**Markup.** `<div class="rt-banner rt-banner--{danger|warning|info}">` with an 18px icon, the message (bold lead sentence), and optional `.rt-banner__actions`.

- Say what happened and what to do next: "Couldn't export to Hilan. The connection expired yesterday. Reconnect." Never codes ("Error 503") or blame.
- One banner per page region. Persistent until resolved; never auto-dismiss errors.
