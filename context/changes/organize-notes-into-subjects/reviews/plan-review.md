<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Organize Notes into Subjects

- **Plan**: context/changes/organize-notes-into-subjects/plan.md
- **Mode**: Deep
- **Date**: 2026-06-03
- **Verdict**: REVISE → SOUND (all findings fixed in triage)
- **Findings**: 1 critical · 1 warning · 2 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | WARNING |
| Blind Spots           | FAIL    |
| Plan Completeness     | WARNING |

## Grounding

10/10 paths ✓ (select.tsx correctly absent), symbols ✓ (runTableAction in all note actions; `(select auth.uid())` idiom in init migration), brief↔plan ✓.

## Findings

### F1 — RLS does not guard cross-user subject_id assignment

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — one policy clause, but it's the project's #1 guardrail
- **Dimension**: Blind Spots
- **Location**: Phase 1 (migration) / Critical Implementation Details
- **Detail**: notes UPDATE policy is `with check ((select auth.uid()) = user_id)` only (init migration :30-33) — validates the note's owner but not that a referenced `subject_id` is the caller's. FK guarantees existence, not ownership. App-layer-only mitigation contradicts the stated guardrail "isolation enforced at the DB via RLS, not app code" (roadmap F-02).
- **Fix ⭐**: Extend notes INSERT + UPDATE `with check` with `subject_id is null or exists (select 1 from subjects s where s.id = subject_id and s.user_id = (select auth.uid()))` in the Phase 1 migration; create `subjects` before altering `notes`.
  - Strength: Closes the hole at the DB where every other isolation guarantee lives; airtight.
  - Tradeoff: A subquery per note write (negligible).
  - Confidence: HIGH — mirrors the existing RLS idiom.
  - Blind spot: None significant; Phase 5 isolation E2E proves it.
- **Decision**: FIXED (Fix applied in plan — Critical Impl Details + Phase 1 contract)

### F2 — `position = max(position)+1` is a read-before-write with no precedent and a race

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — note assignment
- **Detail**: All 10 actions under src/features/\*\*/actions/ end in a post-write `.select('id').single()`; none reads before writing. `max(position)+1` introduces a new query shape plus a read-modify-write race (concurrent assigns → duplicate positions).
- **Fix ⭐**: Compute `position = Date.now()` in the action (append-to-end, no read, no race); drag-reorder still writes midpoints.
  - Strength: Eliminates the read and race; keeps position-null-iff-subject-null invariant.
  - Tradeoff: Positions are large epoch numbers, not 1,2,3 (cosmetic).
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix applied in plan — Critical Impl Details + Phase 2 contract)

### F3 — Document view does N sequential Shiki renders, unbounded

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Phase 3 — /subjects/[id]
- **Detail**: RenderMarkdown awaits Shiki per call; N member notes = N async highlight passes. Same class as deferred S-02 F1. Fine at MVP scale but should be named, not silent.
- **Fix**: One-line note in Performance section + follow-ups/review-fixes.md; no code change this slice.
- **Decision**: FIXED (Performance section note added)

### F4 — notes-schema unit test not in the plan's test surface

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy
- **Detail**: `src/__tests__/notes-schema.test.ts` asserts the parse shape of noteInputSchema; optional `subject_id` won't break it but isn't in the plan's test surface.
- **Fix**: Add a `subject_id` case to the plan's Unit Tests.
- **Decision**: FIXED (Testing Strategy bullet added)
