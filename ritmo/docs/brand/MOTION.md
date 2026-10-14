# Ritmo — Motion

Ritmo's motion is **calm, quick and physical**: Linear's restraint with Apple's sense of weight. Motion exists to confirm an action, show where something came from or went, and keep the user oriented. If an animation does none of these, it does not ship.

Live reference: `docs/screens/05-states-and-motion.html` (every choreography below, clickable). Implementation: `design/motion.css` (CSS), `design/motion.ts` (Motion/Framer Motion + React Native Reanimated). Tokens live in `design/tokens.css`.

## Principles

1. **Fast by default.** Most UI motion is 120–260ms. Nothing in the product takes longer than 600ms, and only one thing takes that long: the clock-in ring.
2. **Enter on ease-out, move on ease-in-out, exit on ease-in.** Exits are faster than entrances (about 0.6×).
3. **Nothing bounces.** Springs are critically damped (no overshoot) and reserved for direct manipulation: dragging, sheets, sliding indicators.
4. **Transform and opacity only.** Never animate width, height, top/left, or large blurs. Layout changes use FLIP/shared-layout techniques.
5. **Interruptible.** Every animation can be reversed mid-flight (a second tap, Esc, a swipe back) without waiting.
6. **Keyboard is instant.** Actions repeated from the keyboard (arrow-moving a shift, j/k through a list) do not animate.
7. **Direction-aware.** Every horizontal offset is multiplied by the writing direction: what slides toward inline-end in English slides left in Hebrew.
8. **Respect reduced motion.** With `prefers-reduced-motion: reduce`, movement becomes an instant state change (opacity ≤ 120ms), loops stop (live dot, shimmer), haptics stay.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--dur-fast` | 120ms | Hover, press, color changes, exits |
| `--dur-base` | 200ms | Toggles, tab indicator, number changes, popovers |
| `--dur-moderate` | 260ms | Row/card entrance, dialogs, toasts |
| `--dur-slow` | 360ms | Bottom sheets, page transitions, timeline growth |
| `--dur-deliberate` | 600ms | Clock-in confirmation ring (once) |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Anything entering or responding |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Things moving across the screen, crossfades |
| `--ease-in` | `cubic-bezier(0.55, 0, 1, 0.45)` | Anything leaving |
| `--stagger` | 30ms | Between list items; cap at 8 items |
| `--press-scale` | 0.97 | Pointer press on buttons and the clock |
| Offsets | 4 / 8 / 16px | Exit nudge / standard rise / toast rise |
| Springs | snappy 520/44, gentle 280/34, indicator 420/40 | stiffness/damping, no overshoot |

## Choreographies

| Moment | What happens | Timing |
| --- | --- | --- |
| **Clock in** (signature) | Press scales the lime button to 0.97 → on release a 2px lime ring expands from the button (scale 1→1.7, fades out) **once** → fill crossfades lime → amber and the label becomes "Clock out" → the timer rises 8px into place and starts ticking. Haptic: success. | 120 + 600 (ring, overlapping) + 200 + 260ms; under 700ms total |
| **Clock out** | Fill crossfades amber → lime; the day's timeline segment stops growing; summary toast "7h 42m today". Haptic: success. | 200ms + toast |
| **Live dot** | A soft ring breathes out of the dot (scale 1→2.4, fades). Only on *your own* live state (tracking, on shift). Static when paused. | 2.4s loop |
| **List / table enter** | Rows fade in and rise 8px in reading order. Rows after the 8th arrive with the 8th. Only on first load, never on refresh or sort. | 260ms, 30ms stagger |
| **Inline approve** | Button shows a check, the row slides 12px toward inline-end and fades, the list closes the gap (shared layout), a toast offers Undo for 5s. | 120ms exit + 200ms reflow |
| **Number update** | The new value slides in 6px from the direction of change (up for increase). Never count-up animations; never animate on every websocket tick (max once per 2s per number). | 200ms |
| **Popover / menu / tooltip** | Scale 0.96 → 1 + fade, from the trigger's side (`transform-origin` at the trigger). Tooltips appear after 400ms hover, instantly when moving between tooltips. | 200ms in, 120ms out |
| **Dialog** | Overlay fades; panel rises 8px and scales 0.98 → 1. Esc or backdrop closes. Focus moves into the dialog and returns to the trigger. | 260ms in, 120ms out |
| **Bottom sheet (mobile)** | Slides up on the gentle spring; drag down to dismiss with velocity; backdrop opacity tracks the drag. | spring |
| **Toast** | Rises 16px from the block-end edge with scale 0.98 → 1. Stacks with 8px gaps; pauses its timer on hover/focus. | 260ms in, 120ms out |
| **Segmented control / tabs** | The selected surface slides between options (shared `layoutId`). | indicator spring |
| **Shift drag** | Pickup: scale 1.02 + `shadow-md` (haptic light). Follows pointer 1:1. Drop: snaps into the cell on the snappy spring (haptic medium); neighbours reflow. Invalid drop: returns to origin on the same spring and shows the reason inline. No shaking. | 120ms pickup, spring drop |
| **Timeline growth** | The live segment extends every minute with `transform: scaleX` from the inline-start edge. | 360ms ease-in-out |
| **Skeleton** | Shown only if loading takes longer than 300ms; shimmer moves in the writing direction; content replaces it with a 120ms fade. | 1.6s loop |
| **Rhythm loader** | The mark's three bars contract and extend in sequence. The only spinner in Ritmo, used for AI work and long jobs. Pair with a sentence saying what's happening. | 1.2s loop |
| **AI streaming** | Text fades in per chunk (120ms); a proposal card appears with the standard enter only when complete. | 120ms |
| **Page change** | Sidebar and header stay still; content fades in and rises 8px. No slide between pages. | 200ms |
| **Theme switch** | View Transitions API crossfade of the root. | 200ms |

## Haptics (mobile)

| Event | expo-haptics |
| --- | --- |
| Toggle, segmented control, day picker | `selectionAsync` |
| Clock in / out, approve | `notificationAsync(Success)` |
| Outside the geofence | `notificationAsync(Warning)` |
| Error | `notificationAsync(Error)` |
| Drag pickup / drop | `impactAsync(Light)` / `impactAsync(Medium)` |

## Never

Bounce or elastic easing · confetti or celebrations · parallax · count-up numbers · animated gradients or glows · auto-playing carousels · loaders without a label · animation longer than 600ms in product UI · motion that blocks input · different motion for the same action in two places.
