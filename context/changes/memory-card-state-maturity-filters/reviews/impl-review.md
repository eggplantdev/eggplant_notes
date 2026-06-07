<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Memory-Card State & Maturity Filters

- **Plan**: context/changes/memory-card-state-maturity-filters/plan.md
- **Scope**: Phases 1–3 (full plan)
- **Date**: 2026-06-07
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension           | Verdict                                  |
| ------------------- | ---------------------------------------- |
| Plan Adherence      | PASS                                     |
| Scope Discipline    | PASS                                     |
| Safety & Quality    | PASS                                     |
| Architecture        | WARNING                                  |
| Pattern Consistency | WARNING                                  |
| Success Criteria    | PASS (verified green pre-parallel-break) |

## Findings

### F1 — State/maturity param validation lives inline in the route

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Architecture
- **Location**: src/app/(protected)/memory-cards/page.tsx:38-45 (pre-fix)
- **Detail**: Non-trivial domain validation (state 0–3, maturity union-guard) lived inline in a thin route file.
- **Fix**: Extracted `parseCardFilters` into `features/memory-cards/utils/parse-card-filters.ts` (state bound now derived from `FSRS_STATE_LABELS.length`), wired through the barrel, page reduced to `const { states, maturity } = parseCardFilters(sp)`. Added `src/__tests__/parse-card-filters.test.ts` (7 cases: empty, no-coerce-to-0, valid, junk-dropped, maturity buckets, unknown-dropped, combined).
- **Decision**: FIXED

### F2 — E2E selected popover options by visible copy

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: e2e/memory-card-filters.spec.ts:47,56 (pre-fix)
- **Detail**: `getByRole('option', { name: 'Review'|'Mature' })` coupled the locator to copy (lessons.md:119), inconsistent with the testid-targeted triggers.
- **Fix**: Added a per-option `data-testid` to `MultiSelect`'s `CommandItem`, derived from the trigger testid (`${dataTestId}-option-${value}`, only when a caller opts in so the primitive stays generic). Spec now targets `filter-state-option-2` / `filter-maturity-option-mature`. cmdk forwards arbitrary props to the option `div` (verified in source); live e2e re-run pending the parallel-session build-break clearing.
- **Decision**: FIXED

### F3 — No index backing the `stability` maturity predicate

- **Severity**: OBSERVATION
- **Dimension**: Safety & Quality (performance)
- **Location**: src/features/memory-cards/queries.ts
- **Detail**: The maturity `.gte/.lt('stability')` predicate has no supporting index. Non-issue at personal scale; matches the project's stated stance (queries.ts:42). Noted as a known scaling edge.
- **Decision**: ACCEPTED (no action)

### F4 — Notes-page like-for-like refactor

- **Severity**: OBSERVATION
- **Dimension**: Plan Adherence
- **Location**: src/app/(protected)/notes/page.tsx:44
- **Detail**: Verified unchanged — still `<SubjectFilter options={options} selectedIds={selectedIds} />`. Gap closed during review.
- **Decision**: RESOLVED (verified)
