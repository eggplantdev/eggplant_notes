<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Persistence & Per-User Isolation (F-02)

- **Plan**: context/changes/persistence-and-isolation/plan.md
- **Scope**: Full plan (Phases 1–4 of 4)
- **Date**: 2026-06-03
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Drift agent: zero drift, all 4 planned items MATCH, no scope creep, every "NOT doing" boundary respected. Safety agent: RLS textbook-correct — `(select auth.uid())` predicates, `to authenticated`, `with check` on insert/update, full FK/policy index coverage, correct `auth.users → notes → topic_checks → review_events` cascade, no service-role key. Automated criteria re-verified green this session: typecheck, lint, test, and `test:e2e` (7/7 incl. `isolation.spec.ts`). Manual criteria confirmed incl. the negative control (vacuous `using(true)` → spec fails at RLS assertion; real predicate → passes).

Pre-empted non-findings: bare `default auth.uid()` on `user_id` is correct (init-plan wrapping matters only for policy predicates, not column defaults); `default auth.uid()` + `with check` makes owner-spoofing impossible (proven by the isolation test).

## Findings

### F1 — Wrapper turns a legit empty single-row result into a thrown error

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/supabase/run-table-query.ts:19
- **Detail**: `if (data === null) throw` is correct for today's multi-row reads (PostgREST `.select()` returns `[]`, never null, on empty). But the wrapper is advertised "reusable for mutations." `.maybeSingle()` on a legitimately-absent row returns `{ data: null, error: null }` — under this wrapper that legal "no row" becomes a thrown "returned no data". Harmless now; a trap when the first single-row path lands (S-01/S-03).
- **Fix**: When a single-row/maybeSingle path is added, branch the wrapper (or add a `single` variant) so null-with-no-error returns null instead of throwing. No change needed today.
- **Decision**: SKIPPED — defer to S-01/S-03 when the first single-row path lands

### F2 — Error normalization drops PostgrestError code/details/hint

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/supabase/run-table-query.ts:18
- **Detail**: `throw new Error(error.message)` flattens the PostgrestError, losing `code`/`details`/`hint` — so an RLS denial and a constraint violation look identical at the boundary. Consistent with how `runAuthAction` flattens to `error.message`, so this is a deliberate pattern match, not a defect.
- **Fix**: Leave as-is for parity with runAuthAction; revisit only if a caller ever needs to branch on the DB error code.
- **Decision**: FIXED — `console.error(error)` before throw (logs code/details/hint to server) + `throw new Error(error.message, { cause: error })` so callers can branch on `cause`. Parity with runAuthAction's `.message` preserved. (run-table-query.ts:17-20)

### F3 — Only `notes` isolation is asserted; child tables untested

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: e2e/isolation.spec.ts
- **Detail**: The spec proves RLS isolation on `notes` only. `topic_checks` and `review_events` carry identical policies but aren't directly exercised. Reasonable now — there's no write path for the child tables yet — but the guardrail isn't proven for them.
- **Fix**: Extend the spec to cover topic_checks/review_events when S-01/S-03 add their write paths. Out of scope for F-02.
- **Decision**: FIXED — spec rewritten to seed the full note→topic_check→review_event chain per account (`seedChain`) and assert isolation on all three tables in both directions (`assertIsolated`). Passes 14.9s on a fresh build. (e2e/isolation.spec.ts)
