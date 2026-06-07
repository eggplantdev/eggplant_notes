---
change_id: memory-card-state-maturity-filters
title: Server-side filtering of memory cards by FSRS state and maturity
created: 2026-06-06
updated: 2026-06-07
status: implemented
archived_at: null
---

## Notes

Add two new server-side filters to the `/memory-cards` listing, alongside the existing
subject + `?q=` search filters: **FSRS state** and **maturity**. Both are multiselect.

Decisions (2026-06-06):

- **State** filter → `?state=` URL param, multiselect over the 4 FSRS states
  (0 New · 1 Learning · 2 Review · 3 Relearning, `FSRS_STATE_LABELS`). Predicate:
  `.in('state', [...])`.
- **Maturity** filter → `?maturity=` URL param, multiselect over Mature / Young.
  Maturity is NOT an FSRS variable — it's a derived label over the algorithm's
  `stability` output: Mature = `stability >= MATURE_STABILITY_DAYS` (21, confirmed),
  Young = `stability < 21`. Predicate: `.gte`/`.lt('stability', 21)`, OR-composed when
  both buckets selected. Import `MATURE_STABILITY_DAYS`; do not re-hardcode 21.
- **Generalize** `SubjectFilter` → a reusable URL-driven multiselect component (3rd
  consumer triggers the promotion rule). It currently hardcodes the `subjects` URL key
  - "Subjects" copy; parameterize on URL key / label / options while preserving the
    two-mode selection + debounce-batch + chips behavior (lessons.md:62). State, maturity,
    and subjects all consume the generalized component.
- No migration, no computed column, no RPC — both filters reduce to plain PostgREST
  column predicates. `getMemoryCardsList`'s existing `filtered(head)` factory composes
  them (same shape as the current `.in('subject_id')` + `searchOr`), through
  `runPaginatedQuery` (416-overflow fallback already solved, lessons.md:155).
- The "Cards overview" chart stays whole-deck (ignores filters) — unchanged.
- New public surface → per-slice review gate + E2E spec.

Sequencing: `memory-card-review-page` (the standalone card page) still has its Phase 2
E2E + archive pending — close that out separately; this is an independent change.
