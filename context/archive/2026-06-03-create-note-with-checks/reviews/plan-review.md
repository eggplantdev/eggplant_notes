<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Create a Note with Topic Checks Inline (S-07)

- **Plan**: context/changes/create-note-with-checks/plan.md
- **Mode**: Deep
- **Date**: 2026-06-03
- **Verdict**: SOUND (REVISE → SOUND after triage)
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | PASS    |
| Plan Completeness     | WARNING |

## Grounding

8/8 paths ✓, symbols ✓ (`topicCheckInputSchema`/`promptSchema`/`optionalText`/`noteInputSchema`/
`record_review`/`delete_account`), brief↔plan ✓. All 6 deep-verification claims confirmed:
createNote has no other caller (S-06 uses the `subject_id` field, not the action); NoteForm
discriminated union localizes the contract change to the create branch; `position` has no DB
default (TS derivation correct); `record_review` mirror confirmed; topic_checks insert columns +
RLS confirmed; typegen = `pnpm db:types`. **S-08 (card-to-note-navigation) has uncommitted changes
on `main`** (`topic-checks/queries.ts`, `topic-checks/types.ts`, `review/page.tsx`) — **no overlap**
with S-07's targets (`types.ts` generated, `note-form.tsx`, `create-note.ts`, schemas). Worktree
off HEAD is safe.

## Findings

### F1 — Stale migration-ordering reference

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Critical Implementation Details + Phase 1
- **Detail**: Plan cited "must sort after 20260603131542"; actual latest is
  20260603151508_add_subjects_and_note_ordering.sql (S-06). `supabase migration new` auto-timestamps,
  so ordering is correct in practice, but the anchor understated reality.
- **Fix**: Update the reference to the true latest (…151508).
- **Decision**: FIXED (updated Critical Implementation Details).

### F2 — Typegen command not concrete

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, change #2
- **Detail**: "Use the project's typegen command" is concrete: `pnpm db:types` (package.json:19).
- **Fix**: Name `pnpm db:types` explicitly.
- **Decision**: FIXED (named the command + the void→undefined / uuid→string note).

### F3 — RPC inherits S-06's owned-subject RLS check

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1, RPC contract
- **Detail**: S-06 tightened `notes_insert_own` to require an owned `subject_id`. Under
  SECURITY INVOKER the RPC's note insert inherits that with-check; a forged subject_id aborts the
  transaction. Plan's manual-verify anticipated it; added an explicit contract note.
- **Fix**: Add a sentence to the Phase 1 RPC contract.
- **Decision**: FIXED (added RLS-under-INVOKER note to the RPC contract).
