# Load / Clear Sample Data (S-12) — Plan Brief

> Full plan: `context/changes/seed-sample-data/plan.md`
> Design spec: `docs/superpowers/specs/2026-06-06-seed-sample-data-design.md`

## What & Why

S-12 (the deferred "final slice"): a one-click **Load sample data** for an empty account + a
paired **Clear sample data**. This is a course project graded by tutors — they need to see the
whole product working (subjects, notes-with-code, memory cards, the recall loop) without
hand-entering data first.

## Starting Point

No sample-data feature exists; empty accounts show only a "Create a note" empty state. The only
sample content is the dev-only `supabase/seed.sql` `test@gmail.com` corpus, which never runs on
Vercel — so prod has no copy of it and no template account to copy from.

## Desired End State

An empty account shows Load in `/settings` and the `/notes` empty state. Load populates the
user's own account (subjects + notes-with-code + cards, all due now) flagged `is_seeded=true`,
so `/notes`, `/subjects`, `/review`, and the dashboard due-count come alive. Clear (shown only
when seeded rows exist) removes exactly the seeded rows. Works on local and prod.

## Key Decisions Made

| Decision           | Choice                                | Why (1 sentence)                                                      | Source |
| ------------------ | ------------------------------------- | --------------------------------------------------------------------- | ------ |
| Content source     | `seed.sql` corpus, never modified     | Single source of truth stays the seed; feature only reads it          | Spec   |
| Prod delivery      | Generated, committed TS fixture       | Prod has no template account; a bundled fixture ships the content     | Spec   |
| Stale-proofing     | Regenerate fixture via a dump script  | Content isn't final; never hand-edit the fixture                      | Spec   |
| Demo depth         | Cards + due-now only                  | Simpler; cards default to `state=0`/`due_at=now()` so `/review` works | Spec   |
| Isolation          | Per-user RLS inserts, no service-role | Keep the #1 guardrail intact                                          | Spec   |
| `is_seeded` marker | All three tables                      | Uniform marker; precise Clear scoping                                 | Plan   |
| E2E                | Author, best-effort green             | Matches the documented GoTrue sign-up flake + recent slices           | Plan   |

## Scope

**In scope:** `is_seeded` migration; dump script + generated fixture; gating queries;
`loadSampleData`/`clearSampleData` actions with remap + rollback; settings + notes-empty-state
UI; unit test for remap; best-effort E2E.

**Out of scope:** modifying `seed.sql`/`generate-section-seed.mjs`; `review_events`/FSRS history
(heatmap/streak stay empty); service-role; `pg_trgm`/indexes; changing the shared `EmptyState`.

## Architecture / Approach

New module `src/features/sample-data/`. A standalone `dump-sample-fixture.mjs` reads the local
DB's template account and emits `sample-data.ts` (committed, ships to prod). The loader: guard
(account empty) → pure `remap` (assign new ids, map subjectRef/noteRef → parent ids, preserve
`position`, set `is_seeded`) → insert subjects→notes→cards via the RLS client with `user_id`
from the authed session → roll back via the clear path on any error. Clear deletes seeded notes
(cascading cards) then seeded subjects. UI uses S-16 toasts + `useTransition`.

## Phases at a Glance

| Phase                | What it delivers                                               | Key risk                                          |
| -------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| 1. Marker migration  | `is_seeded` on subjects/notes/memory_cards + regenerated types | Forgetting to regen types after `db reset`        |
| 2. Fixture generator | Dump script + committed `sample-data.ts`                       | Local DB connection / capturing the right columns |
| 3. Queries + actions | Gating reads, load/clear, unit-tested remap                    | Remap correctness; partial-failure rollback       |
| 4. UI wiring         | Settings section + notes-empty-state Load CTA + toasts         | Gating visibility logic (Load↔Clear)              |
| 5. E2E + suite       | `sample-data.spec.ts` + full per-slice gate                    | Known E2E sign-up flake                           |

**Prerequisites:** local Supabase stack up (`supabase start`); a `db reset` so the
`test@gmail.com` template account exists before running the dump.
**Estimated effort:** ~1–2 sessions across 5 phases.

## Open Risks & Assumptions

- The fixture regeneration discipline (re-run the dump after editing seed content) is manual —
  documented in the generated file's header; nothing enforces it.
- supabase-js multi-insert isn't transactional; rollback-on-error is best-effort (acceptable for
  a demo affordance).
- E2E may not pass in one run due to the documented local GoTrue sign-up flake.

## Success Criteria (Summary)

- An empty account can one-click Load a full, representative dataset and one-click Clear back to
  empty — on local and prod.
- Seeded rows are owned by the current user only (RLS isolation holds); no cross-user leakage.
- Editing seed content + re-running the dump updates the fixture without touching `seed.sql`.
