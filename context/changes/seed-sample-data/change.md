---
change_id: seed-sample-data
title: Load / Clear sample data — one-click demo populate + reset (S-12)
status: implemented
created: 2026-06-06
updated: 2026-06-06
archived_at: null
---

## Notes

Roadmap slice S-12 (the deferred "final slice"). One-click **Load sample data** for an empty
account + paired **Clear sample data**, so a tutor/evaluator sees the whole product working
without hand-entering data.

**Approved design spec:** `docs/superpowers/specs/2026-06-06-seed-sample-data-design.md`
(brainstormed + approved 2026-06-06). Read it before planning — it carries the binding
constraints and the resolved decisions.

Key resolved decisions (do not re-litigate in planning):

- **Content source = `seed.sql` `test@gmail.com` corpus, but `seed.sql` is NEVER modified.**
- **Must work on prod (Vercel)** → content ships as a **generated, committed fixture**
  (`src/features/sample-data/sample-data.ts`), produced by a new dump script
  `supabase/seed-scripts/dump-sample-fixture.mjs` that reads the local DB (`:54322`). The
  existing `generate-section-seed.mjs` is untouched.
- **Demo depth = cards + due-now only** — no `review_events`, no FSRS state, no timestamps;
  cards load with schema defaults (`state=0`, `due_at=now()`) so `/review` works on load.
- **RLS isolation intact** — per-user inserts via the authed client, `is_seeded` marker column
  (new additive migration) for precise Clear; no service-role, no `user_id` mass-assignment.
- New feature module `src/features/sample-data/`.
