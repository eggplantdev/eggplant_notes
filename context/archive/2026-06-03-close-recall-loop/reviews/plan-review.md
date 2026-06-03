<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Close the Recall Loop (S-03)

- **Plan**: `context/changes/close-recall-loop/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-03
- **Verdict**: REVISE → SOUND (all findings triaged & fixed)
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

7/7 paths ✓ (`/review` + `features/review` absent as expected), 5/5 symbols ✓, brief↔plan ✓,
drop-column blast radius clean ✓ (SM-2 columns referenced only in generated `types.ts`, regenerated
in Phase 1; no app code reads them by name). Typegen command confirmed from archives
(`supabase gen types typescript --local > src/lib/supabase/types.ts`, CLI 2.101.0).

## Findings

### F1 — record_review RPC doesn't self-enforce the card↔caller link

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 (RPC) + Phase 2 (rate action)
- **Detail**: RPC inserted review_events first (its RLS `with check` on `user_id=auth.uid()` always
  passes), then updated topic_checks (RLS scopes to owner → 0 rows if foreign). The FK only requires
  the topic_check to exist, not be owned, so a direct RPC caller could write a review_event in their
  own account against another user's valid topic_check_id while the schedule update no-ops. Not a
  cross-user leak, but a junk-row integrity gap — defeating the integrity reason the atomic RPC exists.
- **Fix**: UPDATE topic_checks first; `if not found then raise exception`; only then INSERT the
  review_event. RPC now enforces ownership itself rather than trusting the Server Action re-fetch.
- **Decision**: FIXED (Fix in plan — RPC contract + snippet updated, update-first ordering)

### F2 — getCurrentStreak has two conflicting signatures

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4, steps 1 and 3
- **Detail**: Step 1 declared `(client?): Promise<number>` (async, DB query); step 3 called it
  `getCurrentStreak(activity)` (sync, reusing the fetched array). Contradictory contracts.
- **Fix**: Lock to `getCurrentStreak(activity: ActivityDayT[]): number` (pure, sync); step 3 now
  fetches `[dueToday, activity]` via `Promise.all` then derives streak from `activity`.
- **Decision**: FIXED (Fix in plan)

### F3 — Typegen command referenced but not spelled out

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Phase 1, step 3
- **Detail**: "the typegen command used in F-02/S-05" isn't a package.json script.
- **Fix**: Inlined `supabase gen types typescript --local > src/lib/supabase/types.ts` and added a
  `db:types` package script for repeatability.
- **Decision**: FIXED (Fix in plan + add db:types script)

### F4 — record_review missing `set search_path = ''`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Phase 1, RPC
- **Detail**: Supabase linter flags "Function Search Path Mutable" even for SECURITY INVOKER funcs;
  `delete_account()` sets `search_path = ''` + fully-qualified names.
- **Fix**: Added `set search_path = ''` + `public.`-qualified table names to the RPC contract (folded
  into the F1 edit).
- **Decision**: FIXED (confirmed — applied with F1)

### F5 — UTC day-grouping vs the user's local "today"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — worth a conscious decision
- **Dimension**: Blind Spots
- **Location**: Phase 4 (streak/activity) + dashboard heatmap `today`
- **Detail**: `ActivityDayT.date` is UTC (S-04) and Vercel functions run in UTC, so a ~23:30-local
  review buckets into the next day — streak/heatmap could read off-by-a-day, risking the
  "streak reads 1 / heatmap marks today" success criterion for late-night reviews.
- **Fix**: Introduce a single `APP_TIME_ZONE` IANA constant in `features/dashboard/constants.ts`;
  bucket activity on `(reviewed_at at time zone APP_TIME_ZONE)::date`; compute the streak's "today"
  and the heatmap's `today` in the same zone.
- **Decision**: FIXED (Fix in plan — local-offset grouping)
