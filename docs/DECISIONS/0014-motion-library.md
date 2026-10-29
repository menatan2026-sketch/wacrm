# 0014 — CSS for micro-interactions; Motion (motion.dev) for orchestration

- **Status:** Accepted (planning)
- **Date:** 2026-10-29
- **Related:** MOTION_SYSTEM.md

## Decision
Micro-interactions are pure CSS transitions driven by motion tokens. Orchestrated, layout and gesture animation uses Motion, loaded via `LazyMotion` only where needed. Reduced motion is handled centrally in `packages/motion`, with a user override. Informational sequences are bound to real events.

## Consequences
No motion cost on simple routes. One API for complex sequences. Performance verified with trace-based FPS checks.
