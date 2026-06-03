<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Persistence & Per-User Isolation (F-02)

- **Plan**: context/changes/persistence-and-isolation/plan.md
- **Mode**: Deep
- **Date**: 2026-06-03
- **Verdict**: REVISE → SOUND (after fixes)
- **Findings**: 1 critical, 1 warning, 1 observation (all resolved)

## Verdicts

| Dimension             | Verdict         |
| --------------------- | --------------- |
| End-State Alignment   | PASS            |
| Lean Execution        | PASS            |
| Architectural Fitness | PASS            |
| Blind Spots           | FAIL → fixed    |
| Plan Completeness     | WARNING → fixed |

## Grounding

5/5 existing paths ✓ (`server.ts`, `client.ts`, `run-auth-action.ts`, `action.ts`, `e2e/auth.spec.ts`), 3/3 not-yet-existing confirmed absent ✓ (`types.ts`, `supabase/migrations`, `e2e/isolation.spec.ts`), 4/4 scripts ✓ (`lint`/`typecheck`/`test`/`test:e2e`), brief↔plan ✓.

Verified-safe (no findings): `gen_random_uuid()` is core in PG17 (no extension); client-injection requirement is real (`server.ts:2,8` uses `next/headers` `cookies()`); typing factories is additive (5 callers all `.auth.*`, zero `.from()`).

## Findings

### F1 — Phase 4 test process has no env vars and no JS-readable session

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 4 — Two-account isolation E2E
- **Detail**: (a) `playwright.config.ts` loads no `.env` (only `process.env.CI`); the spec process can't read `NEXT_PUBLIC_SUPABASE_ANON_KEY` and can't import `@/lib/env` (Next path alias). (b) `@supabase/ssr` stores the session as HttpOnly base64-chunked cookies — no JS-accessible token to "reuse from the signed-in context." Phase 4 as written won't run.
- **Fix ⭐**: Pin the test runtime — load dotenv in `playwright.config.ts` (or use the well-known local anon key) and authenticate each account via `signInWithPassword(email, pw)` with the test's own credentials, not browser-cookie reuse.
- **Decision**: FIXED (Fix applied — edited Critical Implementation Details + Phase 4 contract + added Phase 4 prerequisite)

### F2 — Plan conflates "reuse browser token" with "sign in programmatically"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 contract + Critical Implementation Details
- **Detail**: `plan.md:46` listed the two as interchangeable; only programmatic sign-in is straightforward. Prose root of F1.
- **Fix**: Commit to `signInWithPassword`, drop the browser-token option (folds into F1).
- **Decision**: FIXED (covered by F1 edit)

### F3 — getTopicChecksDue returns all rows until S-03

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Lean Execution
- **Location**: Phase 3 — read helpers
- **Detail**: `due_at` defaults to `now()` and nothing writes it until S-03, so a `due_at <= now()` helper returns every row. Harmless (read-only, no consumer), but worth a comment so it's not mistaken for a bug.
- **Fix**: Add a code-comment note to the `getTopicChecksDue` contract.
- **Decision**: FIXED (note added to Phase 3 contract)
