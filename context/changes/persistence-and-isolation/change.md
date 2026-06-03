---
change_id: persistence-and-isolation
title: Persistence and per-user isolation for notes, topic checks, and review events
status: implementing
created: 2026-06-02
updated: 2026-06-03
archived_at: null
---

## Notes

F-02 / EX-360. First migration in the repo (`supabase/migrations/` is empty — F-01 built against `auth.users` only). Create the core domain tables — `notes`, `topic_checks`, `review_events` — with RLS scoped by `auth.uid()`, verified by a real two-account isolation test.

Locked decision (do not re-litigate in plan): `review_events.rating` uses the **SM-2 0–5 quality scale** (SuperMemo-2 grade 0–5). The planner proposes the rest of the schema; rating scale is fixed.

Reuse F-01's Supabase client wiring + typed env patterns. North-star slice S-03 (close-recall-loop) sits downstream of this foundation.
