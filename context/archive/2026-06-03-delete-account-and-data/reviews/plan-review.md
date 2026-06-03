<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Account Self-Deletion & Owned-Data Teardown (S-05)

- **Plan**: context/changes/delete-account-and-data/plan.md
- **Mode**: Deep
- **Date**: 2026-06-03
- **Verdict**: REVISE → SOUND (both findings fixed in triage)
- **Findings**: 0 critical · 1 warning · 1 observation

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

10/10 paths ✓ (incl. confirmed-absent `(protected)/settings` and `features/account`), cascade chain + `AlertDialogAction` variant prop + `sign-out.ts`/`runAuthAction`/`ActionResultT` symbols ✓, brief↔plan ✓.

## Findings

### F1 — Sign-in is a client component; `?deleted=1` notice can't use the searchParams prop

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness / Blind Spots
- **Location**: Phase 2 — Change #5 (sign-in notice)
- **Detail**: `sign-in/page.tsx:1` is `'use client'`, so it cannot receive the server `searchParams` page prop; the param must come from `useSearchParams()`. In Next 16 an un-suspended `useSearchParams()` on this statically-rendered route fails `next build`, and Phase 3's E2E runs a real `pnpm build && pnpm start` — so the gap surfaces as a Phase-3 build failure. There is also no existing search-param notice "style" to mirror (current `FormError` is `useState`-driven from form submission).
- **Fix**: Rewrote Phase 2 #5 to specify a small client `DeletedNotice` subcomponent using `useSearchParams()`, rendered inside a `<Suspense>` boundary, reusing `FormError`/notice markup.
- **Decision**: FIXED (Fix in plan)

### F2 — Local definer-privilege check won't prove the hosted case

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; note it and move on
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Manual Verification 1.4
- **Detail**: On a local stack `postgres` (owner of the migration-created definer fn) is effectively superuser, so the `auth.users` delete succeeds regardless of grants. On hosted Supabase `postgres` is not a superuser and may lack delete on `supabase_auth_admin`-owned `auth.users`, so a green local check gives false confidence for the eventual deploy. Hosted `db push` is out of scope now.
- **Fix**: Added a "hosted-privilege caveat" bullet to Migration Notes — re-verify on first hosted apply; fallback is owning the fn as `supabase_auth_admin` or an explicit grant. No code change now.
- **Decision**: FIXED (Fix in plan)
