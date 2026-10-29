# Motion System

> Status: **Draft v0.1 — awaiting owner approval** · Phase 0D
> Source of truth in code: `packages/motion` (tokens + React primitives). Library: CSS transitions for micro-interactions; **Motion** (motion.dev) for orchestrated, layout and gesture animation (ADR-0014).

## 1. Purpose

Motion is an information layer. Every animation must answer **"what is the system doing, and what changed?"** If an animation can't be justified as feedback, a state transition, process explanation or orientation, it's removed.

**Rules**
- Never delay an action. Animations run *after* the input is accepted and never block the next input.
- Never fake progress. Staged animations are bound to **real** state events (upload bytes, analysis stage events, webhook confirmations).
- Interruptible: any animation can be interrupted by a new state. Use springs or `animate()` with the current value as the start.
- Animate `transform` and `opacity` only (plus `clip-path` for reveals). No layout-thrashing properties. Target 60 fps; budget ≤ 4 ms main-thread work per frame.
- Admin: functional motion only (micro and fast tokens, no educational sequences).

## 2. Motion tokens

### 2.1 Durations

| Token | Duration | Use |
|---|---|---|
| `instant` | 0 ms | Reduced motion, value changes in dense tables |
| `micro` | 100 ms | Hover, press, focus, toggles, checkbox ticks |
| `fast` | 160 ms | Tooltips, dropdowns, chip state, small reveals |
| `standard` | 240 ms | Dialogs, drawers, step transitions, card selection |
| `slow` | 360 ms | Large surface transitions, page-level content swap, bottom sheets |
| `educational` | 600–1600 ms (per scene step) | Process explainers: upload → analysis, production timeline, routing explainer |
| `success` | 480 ms (+ 700 ms hold) | Success confirmations: payment confirmed, QC pass, job accepted |
| `critical` | 200 ms, no overshoot | Error emphasis, destructive confirmations, blocking alerts |

### 2.2 Easing

| Token | Curve | Use |
|---|---|---|
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Most transitions |
| `ease-enter` | `cubic-bezier(0, 0, 0, 1)` | Elements entering (decelerate) |
| `ease-exit` | `cubic-bezier(0.3, 0, 1, 1)` | Elements leaving (accelerate). Exit duration = 0.75 × enter |
| `ease-emphasized` | `cubic-bezier(0.2, 0, 0, 1.0)` over `slow` | Hero/educational moments |
| `ease-linear` | `linear` | Progress bars bound to real values, the toolpath draw |
| `ease-mechanical` | `steps(n)` / `cubic-bezier(0.65, 0, 0.35, 1)` | Layer buildup (deliberately machine-like) |

### 2.3 Springs (Motion)

| Token | Config | Use |
|---|---|---|
| `spring-snappy` | stiffness 500, damping 40, mass 1 | Selection, toggles, drag drop settle |
| `spring-gentle` | stiffness 260, damping 30 | Cards, sheets, layout shifts |
| `spring-success` | stiffness 400, damping 22 (slight overshoot ≤ 4 %) | Success check morph only |

No bouncy springs elsewhere (no overshoot > 4 %).

### 2.4 Distance, opacity, scale

| Token | Value |
|---|---|
| `move-xs` | 2 px (press feedback) |
| `move-s` | 4 px (tooltip/dropdown offset on enter) |
| `move-m` | 8 px (toast, list item enter) |
| `move-l` | 16 px (step transitions, along the inline axis, mirrored in RTL) |
| `move-xl` | 24–100 % (sheet/drawer from the edge) |
| Opacity | enter 0 → 1. Exit 1 → 0. Never animate below 0.4 for content that remains (avoid flicker) |
| Scale | press 0.98 · card press 0.99 · dialog enter 0.96 → 1 · never > 1.02 on hover |

**Direction:** horizontal motion uses the logical inline axis (`--motion-inline: 1` in LTR, `-1` in RTL). "Next step" content enters from inline-end and "back" from inline-start, so the step transition feels correct in Hebrew.

## 3. Informational animations

Each scene is a state machine whose stages are driven by real events. Every scene has a **reduced-motion equivalent** (§6).

### 3.1 File upload → validation → analysis → result

| Stage (real event) | Visual | Text (from i18n) |
|---|---|---|
| File selected | The file row appears (`move-m`, `fast`), with the file icon morphing into a 3D-file glyph | File name, size |
| Uploading (bytes progress) | A linear progress bar bound to bytes, and a toolpath outline tracing the dropzone border proportionally | "Uploading · 42 %" |
| Validating (`file.scanned`) | The toolpath completes and the outline fills | "Checking the file" |
| Analysis stages (`geometry.stage` events) | A vertical checklist where each item ticks when its event arrives: **parsing mesh → measuring dimensions → checking geometry → checking printability → estimating volume → matching materials** | Stage labels; dimensions appear in mono **as soon as known** (progressive result) |
| Result | Wireframe preview fades to solid (`slow`). The bounding box and dimension callouts draw in (`educational`, 600 ms) | "Your part is 120 × 80 × 35 mm" |
| Failure | The failed stage turns `danger` (`critical`) and the remaining stages are dimmed, with a fix-tip card below | Plain-language reason + action |

If the geometry service emits only coarse events in the MVP, the checklist shows only those events. Stages are never animated on a timer.

### 3.2 Production timeline (order tracking)
digital model → slicing/prep → **layer buildup** → production complete → inspection → shipment → delivered.
- The current stage pulses gently only while active, as a **layer-buildup** glyph: horizontal strata stacking with `ease-mechanical`, 1 loop per 1.6 s, max 3 loops then static (no infinite attention-grabbing loops), restarted on focus/visibility.
- Completed stages show a timestamp. Future stages show an estimate in `text-secondary`.
- Exception branches (QC failed → reprint) slide in as an inline branch with `warning` color and an explanation.

### 3.3 Routing explainer (admin)
order → compatible suppliers (cards fan out, with excluded ones greyed out plus their reason) → scoring (score bars fill to their **actual stored values**) → capacity check → final assignment (the chosen card lifts, others recede). Played on demand ("Explain this decision"), with a scrubber; static by default in the admin.

### 3.4 QC
inspection photos appear → measurements fill row by row with pass/fail ticks → defect check → verdict stamp (PASS: `success` spring check; FAIL: `critical`, no bounce) → if a reprint is needed, the branch connects back to the production stage on the timeline.

### 3.5 Preview progression (brand signature)
original upload → analyzed version (issues highlighted) → manufacturing preview (layer-line shader, build-plate orientation) → final design. A cross-fade plus clip-path reveal along the build (Z) axis, 600 ms per transition, user-controlled via a segmented control. Never autoplayed in a loop.

## 4. Micro-interactions

| Element | Interaction | Token |
|---|---|---|
| Button | Press scale 0.98, color shift; loading spinner fade-in after 150 ms (avoids flash on fast responses); success check morph | `micro`, `success` |
| Card (interactive) | Hover border to strong; press 0.99; select: the border draws plus the check badge pops (`spring-snappy`) | `micro`, `fast` |
| Upload dropzone | Drag-over: the outline becomes a moving dashed toolpath; drop: settle | `fast` |
| Toggle / switch | Thumb slides with `spring-snappy`; track color `micro` | — |
| Tabs | The indicator slides between tabs (shared layout), mirrored in RTL | `standard` |
| Selection (radio cards) | Others dim to 0.85 opacity? **No.** Keep them at full opacity (readability); only the selected one changes | — |
| Validation | The error message height-expands (`fast`); field shake **not used** (a11y/vestibular) | `fast` |
| Success (inline) | Check stroke draws in 240 ms | `standard` |
| Drag & drop (admin board, Phase 3+) | Lifted item `floating` elevation, placeholder gap animates | `spring-gentle` |
| Filtering / list updates | Items enter/exit with fade + `move-m`, reorder with layout animation; **disabled** above 50 items (just swap) | `fast` |
| Number changes (price) | A crossfade between old and new value with a subtle vertical 4 px slide. **No** counting-up animation for money (feels manipulative, and hurts readability) | `fast` |
| Toast | Enter from block-end (bottom on mobile, top-inline-end on desktop) | `standard` |

## 5. Anti-patterns (rejected at review)
Random bouncing · infinite spinners (> 10 s without an explanation) · decorative parallax · animating every element on page load · staggered lists > 6 items · glow pulses · scroll-jacking · auto-rotating 3D models that the user didn't start · animation that hides the primary action until it finishes.

## 6. Accessibility and reduced motion

- `prefers-reduced-motion: reduce` → `packages/motion` switches every token to `instant` or a ≤ 120 ms opacity crossfade. Springs become fades. Educational sequences become **static step lists with the same text and the same real states**. The layer-buildup glyph becomes a static icon with a "In production" label.
- An in-app setting "Reduce motion" (account → accessibility) overrides the OS setting in both directions, persisted.
- No information is conveyed only by motion: every animated state change is also a text and/or icon change, announced through `aria-live="polite"` (stage progress) or `assertive` (errors).
- No flashing > 3 per second. No motion triggered by scroll for essential content.
- The 3D viewer: no auto-rotate when reduced motion is on; keyboard controls (arrows rotate, +/- zoom, 0 reset).

## 7. Performance
- The Motion library is code-split: micro-interactions are pure CSS, and Motion loads only in the surfaces that use orchestrated sequences (it's tree-shaken, using the `m` + `LazyMotion` pattern).
- Animation FPS is measured in the Playwright perf run (Chrome trace) for the upload scene, the timeline and the viewer. Budget: no long task > 50 ms during animations.
- `will-change` only during the animation and removed after.

## 8. Review checklist (milestone STEP 8)
- [ ] Each animation has a stated purpose (feedback / transition / explanation / orientation)
- [ ] Bound to real state; no timers pretending to be progress
- [ ] Uses tokens only; RTL direction correct
- [ ] Interruptible; doesn't delay or block input
- [ ] The reduced-motion variant conveys identical information
- [ ] 60 fps on a mid-range Android (Moto G-class) in a trace
- [ ] Admin motion limited to micro/fast tokens
