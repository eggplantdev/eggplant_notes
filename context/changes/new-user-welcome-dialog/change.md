---
change_id: new-user-welcome-dialog
title: New-user welcome dialog on an empty dashboard pointing to Settings
status: new
created: 2026-06-09
updated: 2026-06-09
archived_at: null
---

## Notes

On the dashboard, if the account is empty (zero notes AND zero subjects, via the existing
`isAccountEmpty()` probe), show a welcome dialog. Pure pointer: one-line app-flow summary
(note → memory-card → daily-review loop) + a "Go to Settings" CTA, mentioning that sample
data and OpenRouter connection live in Settings. Reappears every dashboard visit while still
empty; vanishes once content exists. No dismiss persistence (no localStorage, no useEffect) —
the server already knows `isEmpty` via the loader fan-out.

Decisions (brainstorm 2026-06-09):

- Dialog scope: **pure pointer** (no inline actions).
- Dismissal: **show until not empty** (server-gated; reappears while empty).
- CTA target: **Settings now, FAQ later**. FAQ page is being built in a parallel session;
  wire the dialog to it in separate future work.
- Empty check: **server-gate** in `dashboard/loader.ts` (add `isAccountEmpty()` to the
  existing `Promise.all` fan-out), not a client-side probe.

Out of scope: the FAQ page, any narrative section in Settings.
