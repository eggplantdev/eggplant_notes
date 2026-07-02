---
change_id: new-user-welcome-dialog
title: New-user welcome dialog on an empty dashboard pointing to Settings
status: done
created: 2026-06-09
updated: 2026-07-01
archived_at: null
---

## Notes

On the dashboard, if the account is empty (zero notes AND zero subjects, via the existing
`isAccountEmpty()` probe), show a welcome dialog. Pure pointer: one-line app-flow summary
(note → memory-card → daily-review loop) + a "Go to Settings" CTA, mentioning that sample
data and OpenRouter connection live in Settings. Server-gated so it never flashes.

Decisions (brainstorm 2026-06-09):

- Dialog scope: **pure pointer** (no inline actions).
- CTA target: **Settings now, FAQ later**. FAQ page is being built in a parallel session;
  wire the dialog to it in separate future work.
- Empty check: **server-gate** in `WelcomeDialogServer` (reads `isAccountEmpty()`), not a
  client-side probe.

Dismissal — shipped as cookie persistence (supersedes the original "show until not empty,
no persistence" plan): dismissing (close or "Go to Settings") writes `eggplant_welcome_seen`
(`welcome-dialog-cookie.ts`, ~1yr max-age), so it shows once per browser. Persistence is
per-browser, not per-account — a cross-device flag would need a DB column. The server still
also gates on `isAccountEmpty()`, so the dialog only ever appears for an empty account that
hasn't dismissed it.

Copy trimmed 2026-07-01 to a scannable pointer (dropped agent-skill / PWA-install / "rough
edges" pointers — those live in Settings/FAQ).

Out of scope: the FAQ page, any narrative section in Settings.
