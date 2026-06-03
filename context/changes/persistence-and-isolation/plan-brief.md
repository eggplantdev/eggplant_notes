# Persistence & Per-User Isolation (F-02) — Plan Brief

> Full plan: `context/changes/persistence-and-isolation/plan.md`
> Research: `context/changes/persistence-and-isolation/research.md`

## What & Why

The repo's first database migration: three core tables (`notes`, `topic_checks`, `review_events`) with Row-Level Security so no user can ever read another's data — even with an app-layer bug. This is the PRD's #1 guardrail, enforced at the database, not in application code.

## Starting Point

`supabase/migrations/` doesn't exist yet — F-01 built auth against `auth.users` only. Two Supabase client factories exist but are **untyped** (no `Database` generic). There is no data-access layer of any kind: zero `.from()` table reads in the repo. Isolation is already RLS-by-design — no service-role client exists, so the anon client + session cookie + `auth.uid()` is the only data path.

## Desired End State

A committed migration creates the three RLS-isolated tables; `src/lib/supabase/types.ts` exists and both factories are `<Database>`-typed; typed read helpers exist per feature; and `pnpm test:e2e` includes a passing isolation test proving account B cannot read account A's rows. Mutations and UI remain for the vertical slices.

## Key Decisions Made

| Decision               | Choice                                                      | Why                                                                                            | Source    |
| ---------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------- |
| Scope                  | Migration + types + thin read helpers + test                | Prove the contract end-to-end without pre-building UI-coupled mutations the slices will design | Plan      |
| SM-2 scheduling state  | Mutable columns on `topic_checks` (CQRS read-model)         | O(1) "what's due now" query for the S-03 loop; `review_events` stays an append-only log        | Plan      |
| SM-2 columns in F-02   | Include now, unwritten until S-03                           | Ships the `(user_id, due_at)` index with the table — no later ALTER of a core table            | Plan      |
| `review_events.rating` | SM-2 0–5 quality scale                                      | Pre-locked product decision                                                                    | (pre-set) |
| Query path             | Feature-local `{data,error}` table wrapper                  | Establish the centralized typed-query pattern now; reusable when mutations land                | Plan      |
| Typegen                | Generate + wire `<Database>` this change                    | Helpers typed from line one; migration is when the schema exists                               | Plan      |
| Isolation test         | Playwright E2E, two real accounts                           | Tests RLS through a real session; matches F-01's harness                                       | Plan      |
| Ownership / delete     | `user_id … default auth.uid()` + `on delete cascade`        | Inserts can't spoof owner; cascade supports S-05 deletion                                      | Plan      |
| Table relations        | `note → topic_checks → review_events`                       | Matches the note-driven recall model                                                           | Plan      |
| Seed data              | No `seed.sql`                                               | Test creates its own data; keeps isolation assertions honest                                   | Plan      |
| Migration file         | Single file                                                 | One atomic schema unit with ordered FK cascade chain                                           | Plan      |
| RLS idioms             | `(select auth.uid())` + btree indexes + per-action policies | Context7 Supabase best practice (perf + explicit `with check`)                                 | Research  |

## Scope

**In scope:** first migration (3 tables, RLS, indexes), `Database` typegen + typed factories, feature-local table wrapper, thin typed read helpers, two-account isolation E2E.

**Out of scope:** mutation Server Actions, notes/review UI, SM-2 write logic, `revalidatePath`, service-role client, `seed.sql`, hosted `db push`.

## Architecture / Approach

Bottom-up and independently verifiable: schema + RLS (the contract) → `Database` typegen → typed read layer → isolation proof. Single migration because the three tables form an FK cascade chain (`notes` → `topic_checks` → `review_events`) that must be created in dependency order. Read helpers accept an **injectable** Supabase client so the isolation test can exercise the same query path it asserts on. `topic_checks` carries SM-2 scheduling columns (event-sourcing log in `review_events` + materialized read-model on `topic_checks`), but the write path that maintains them is deferred to S-03.

## Phases at a Glance

| Phase                      | What it delivers                               | Key risk                                                                          |
| -------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| 1. Migration               | 3 tables + RLS + indexes, applied locally      | A missing `with check` silently allows cross-user inserts                         |
| 2. Typegen + typed clients | `types.ts` + `<Database>` in both factories    | Generated file churn; small factory edits                                         |
| 3. Read-access layer       | Table wrapper + typed read helpers per feature | Helpers must be client-injectable or the test can't use them                      |
| 4. Isolation E2E           | Committed two-account isolation test           | No notes UI — test seeds via authenticated supabase-js clients, not click-through |

**Prerequisites:** F-01 done (✓ archived); `mise install` + `supabase start` up; clean tree.
**Estimated effort:** ~1–2 sessions across 4 phases.

## Open Risks & Assumptions

- **No-UI test shape:** the E2E drives sign-up via real UI but seeds/asserts data via authenticated `supabase-js` clients (no mutation action exists yet). Honest RLS test, but not pure click-through.
- **Snapshot desync (future):** SM-2 columns on `topic_checks` can drift from the `review_events` log if S-03's write path isn't transactional — closeable then via a trigger/RPC. Not F-02's problem (no writes yet).
- **Negative control matters:** the isolation test must be shown to fail when a policy is relaxed, or it could pass vacuously.

## Success Criteria (Summary)

- A new account cannot see any pre-existing account's notes/checks/reviews — proven by a committed, non-vacuous test.
- `.from('notes')` is fully typed across the codebase.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` all green; auth specs don't regress.
