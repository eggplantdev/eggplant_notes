<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Close the Recall Loop (S-03)

- **Plan**: context/changes/close-recall-loop/plan.md
- **Scope**: All 5 phases
- **Date**: 2026-06-03
- **Verdict**: NEEDS ATTENTION (all findings triaged + resolved)
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Verified: no MISSING items, no harmful drift; all F1–F5 plan-review fixes baked in (RPC
update-first guard, pure streak, db:types script, search_path='', single APP_TIME_ZONE driving
bucketing + streak + heatmap-today). Security trust model holds end-to-end (e2e negative control
passes). Migration data-loss safe (no prod data; S-03 is the first writer). Automated success
criteria green: typecheck / lint / unit tests / e2e (review.spec.ts) all pass.

## Findings

### F1 — Cross-feature deep import (features/review-events → features/dashboard)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural; conflicts with a documented rule
- **Dimension**: Architecture
- **Location**: src/features/review-events/queries.ts:3-5
- **Detail**: review-events imports ActivityDayT (types), APP_TIME_ZONE + MS_PER_DAY (constants),
  and isoDateInZone/toISODate/todayInZone (utils) from features/dashboard. AGENTS.md feature-first
  rule: features must not deep-import other features; promote to a shared tier on the 2nd consumer.
  These now have 2 consumers (dashboard + review-events). The plan explicitly chose dashboard
  placement, deferring resolution to this gate's structure check.
- **Fix A ⭐ Recommended**: Promote now — ActivityDayT → src/types/; APP_TIME_ZONE + MS_PER_DAY +
  date helpers → src/lib/utils/. Update importers.
  - Strength: Satisfies the rule; date.ts's own header says "promote ... if a second feature does".
  - Tradeoff: Multi-file mechanical edit right before archive.
  - Confidence: HIGH — pure move + re-import, covered by typecheck.
  - Blind spot: None significant.
- **Fix B**: Log to follow-ups/review-fixes.md, archive as-is.
  - Strength: Smaller diff; matches S-01/S-02 deferral pattern.
  - Tradeoff: Ships a known rule violation into the immutable archive.
  - Confidence: MED.
  - Blind spot: Deferred structural debt ossifies.
- **Decision**: FIXED via Fix A (promoted ActivityDayT → src/types/, APP_TIME_ZONE+MS_PER_DAY+date helpers → src/lib/utils/)

### F2 — getReviewActivity fetches all review_events (unbounded)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — fine for MVP, grows monotonically
- **Dimension**: Safety & Quality (Performance)
- **Location**: src/features/review-events/queries.ts:32-44
- **Detail**: select('reviewed_at') with no time bound — reads all-time history on every dashboard
  load to bucket in TS, though only 53 weeks render. Same family as S-01/S-02's deferred over-fetch.
- **Fix**: Log to follow-ups/review-fixes.md (bound to ~400 days when it matters). Defer.
- **Decision**: FIXED (bounded getReviewActivity to ~400 days)

### F3 — Justified helper bypasses lack an explanatory comment

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/features/topic-checks/queries.ts:25 ; src/features/review/actions/rate-topic-check.ts:41
- **Detail**: getDueCount can't use runTableQuery (head+count returns data:null → it would throw);
  rate-topic-check can't use runTableAction (two inputs + RPC-returns-void). Both correct, but a
  future reader may "fix" them back.
- **Fix**: Add one explaining clause to each comment.
- **Decision**: FIXED (added explanatory clauses to getDueCount + rate-topic-check)

### F4 — Stray comment splits the import group in scheduling.ts

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/features/review/scheduling.ts:3-5
- **Detail**: A comment sits between import lines 1 and 6, reading as a stray split in the import group.
- **Fix**: Move the comment down to previewIntervals/GRADES where it's relevant.
- **Decision**: FIXED (moved comment out of the import group)

### F5 — "Show answer" <details> reveal is an EXTRA beyond the route contract

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision
- **Dimension**: Scope Discipline
- **Location**: src/app/(protected)/review/page.tsx:60-71
- **Detail**: The example/code_context reveal is not in the route contract; user approved keeping it
  during implementation. Recorded for traceability.
- **Decision**: ACCEPTED (approved during implementation)
