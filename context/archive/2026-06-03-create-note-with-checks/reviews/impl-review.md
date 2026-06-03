<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Create a Note with Topic Checks Inline (S-07)

- **Scope**: Phases 1–4 (run during the per-slice review gate, after Phases 1–3 committed)
- **Date**: 2026-06-03
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

> Produced by the parallel review fan-out (`/10x-impl-review` agent). Triaged in the main thread;
> the warnings were fixed during the `/simplify` pass (commit `03c79ff`) or deferred to
> `follow-ups/review-fixes.md`. Companion reports: `plan-review.md` (pre-implementation).

## Verdicts

| Dimension           | Verdict                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------- |
| Plan Adherence      | PASS                                                                                      |
| Scope Discipline    | PASS                                                                                      |
| Safety & Quality    | PASS (RPC mass-assign / atomicity / RLS verified live)                                    |
| Architecture        | WARNING (cross-feature import — adjudicated by feature-first agent: leave, don't promote) |
| Pattern Consistency | PASS                                                                                      |
| Success Criteria    | PASS                                                                                      |

All RPC safety properties verified live against the local Supabase stack: mass-assignment guard
(smuggled `user_id` ignored), all-or-nothing atomicity (forced check-insert failure → 0 orphan
notes), forged `subject_id` rejected by RLS under SECURITY INVOKER, blank `example` → NULL,
`code_context` indentation preserved untrimmed. typecheck + lint clean; build green.

## Findings

### F1 — Cross-feature import (notes → topic-checks schema)

- **Severity**: WARNING · **Dimension**: Architecture
- **Detail**: `features/notes` imports `topicCheckInputSchema`/`promptSchema` from `features/topic-checks`.
- **Resolution**: The `feature-first-structure` agent established the "1st consumer" premise was false
  (`review` + `dashboard` already import from `topic-checks`) and that `topicCheckInputSchema` is an
  **owned domain contract** — promoting it would strip its owner and worsen cohesion. **Decision: do
  not promote** (confirmed with the user). Fixed the misleading comment + deduped `StagedCheckT` by
  deriving `StagedCheckInputT = z.input<typeof topicCheckInputSchema>` (commit `03c79ff`).

### F2 — Unbounded `checks` array

- **Severity**: WARNING · **Dimension**: Safety & Quality
- **Detail**: `z.array(topicCheckInputSchema)` had no upper bound — a client could drive an unbounded
  bulk insert through the RPC.
- **Resolution**: FIXED — `.max(50)` cap added in `schemas.ts` (commit `03c79ff`).

### F3 — Array rows keyed by index (`key={i}`) + `removeValue(i)`

- **Severity**: OBSERVATION · **Dimension**: Pattern Consistency
- **Detail**: Value correctness is safe (fully controlled inputs), but a mid-list removal remounts the
  lazy editors of rows below it (transient focus/scroll loss; values persist).
- **Resolution**: DEFERRED → `follow-ups/review-fixes.md` (rare action, low-volume path; a stable-id
  fix would muddy the clean schema-derived row type).

### F4 — `runTableAction` insert path not orphaned

- **Severity**: OBSERVATION · **Dimension**: Scope Discipline
- **Detail**: The plan flagged the "now-unused createNote insert path" for the gate; the body was
  fully replaced by the RPC call, so nothing is orphaned. `runTableAction` stays live (update/delete).
- **Resolution**: DISMISSED — confirmation only.

### F5 — `position` via `Date.now()` into numeric column

- **Severity**: OBSERVATION · **Dimension**: Plan Adherence
- **Detail**: Faithfully reproduces the pre-S-07 append-ordering behavior; round-trips correctly.
- **Resolution**: DISMISSED — behavior preserved, no regression.

## Companion gate reports

- Tailwind v4 audit: **CLEAN** (0 pre-v4 patterns in `note-form.tsx`).
- `feature-first-structure`: **APPROVED with fixes** (comment + dedupe; no promotion).
- `module-cohesion-audit`: **PASS** (note-form length is altitude, not a cohesion violation;
  `StagedCheckRow` extraction optional, left inline).
- `/simplify`: applied the comment trim; deferred shared field-group dedup + stable keys to follow-ups.
