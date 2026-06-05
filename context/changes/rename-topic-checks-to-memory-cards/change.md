---
change_id: rename-topic-checks-to-memory-cards
title: Rename "topic checks" to "memory cards" across schema, code, routes, and copy
status: implementing
created: 2026-06-05
updated: 2026-06-05
archived_at: null
---

## Notes

Cross-cutting rename of the recall-unit term `topic_checks` → `memory_cards`. Full scope (decided 2026-06-05): UI copy, types, file/dir names, route URL, AND the DB schema. Term chosen after rejecting "Card" (shadcn collision), "Review Card" (overloads the `review` session verb / `features/review`), and "Anki Card" (brand coupling + wrong model — Anki has no card→note path; we run FSRS over Subjects→notes).

Migration strategy (decided): **rewrite migrations in place**, not a forward `ALTER ... RENAME`. Data is disposable — `supabase db reset` will run at least once before the product is considered done. Adjust `seed.sql` + `generate-section-seed.mjs` accordingly.

Rename map:

- `topic_checks` → `memory_cards` (table, RLS, indexes, FSRS fns, `create_note_with_checks` RPC)
- `TopicCheck*` → `MemoryCard*` (types)
- `topicCheck*` → `memoryCard*` (identifiers)
- `topic-checks` / `topic-check` → `memory-cards` / `memory-card` (dirs, files, route URL `/topic-checks` → `/memory-cards`, nav)

Out of scope: `context/archive/` (immutable) and the historical `context/foundation/archive/2026-06-03-roadmap.md`. Live `context/foundation/` docs (prd-v2, roadmap, lessons, shape-notes) get updated.
