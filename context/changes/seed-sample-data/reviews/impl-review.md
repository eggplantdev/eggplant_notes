# Implementation Review — Load / Clear Sample Data (S-12)

Scope: all 5 phases (full plan). Date: 2026-06-06. Read-only review (no files modified by the reviewer).

## Verdict: APPROVED — 0 critical, 2 warnings, 3 observations

| Dimension           | Result                                         |
| ------------------- | ---------------------------------------------- |
| Plan Adherence      | PASS (approved on-demand deviation, not drift) |
| Scope Discipline    | PASS                                           |
| Safety & Quality    | PASS                                           |
| Architecture        | PASS                                           |
| Pattern Consistency | PASS                                           |
| Success Criteria    | WARNING (2 manual items unverified)            |

Core correctness verified by the reviewer:

- **Remap FK integrity** — memoized `idFor(ref)` makes a subject's id and the `note.subjectRef` / `card.noteRef` pointing at it resolve to the SAME uuid; ordered inserts subjects→notes→cards satisfy both the FK constraints AND `notes_insert_own` RLS (a non-null `subject_id` must pre-exist). Confirmed against migrations.
- **Rollback safety** — `deleteSeededRows`' blanket `.eq('is_seeded', true)` is RLS-scoped per caller (`notes_delete_own` / `subjects_delete_own` confirmed) and guarded by `isAccountEmpty()`, so no user content can be collateral.
- **Clear ordering** — notes deleted first (memory_cards cascade via `note_id ON DELETE CASCADE`), then subjects. Correct.
- **RLS scoping** — every write goes through the authed `createClient()`; `user_id` injected from `getCurrentUser()`, never from the fixture.
- **Loader guard + revalidation** — `isAccountEmpty()` gate present; revalidates `/notes`, `/subjects`, `/dashboard`, `/settings`, `/review`.
- Automated: `typecheck` PASS, eslint (slice) PASS, vitest remap 4/4 PASS.

## Findings & triage

| #   | Finding                                                                            | Severity    | Triage  | Resolution                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------- | ----------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Loader ignored `deleteSeededRows`' returned error → a _failed_ rollback was silent | Warning     | fix now | **Applied** (commit `e132f93`): capture rollback result; append "use Clear to reset" hint to the surfaced error when rollback itself fails. |
| F2  | Manual criteria 4.5 (fault-injection rollback) + 5.6 (prod hand-click) unverified  | Warning     | skip    | User chose to skip the manual drive; F1 hardens the path. Left as documented archive warnings.                                              |
| F3  | `isAccountEmpty` comment overstated E2E client injection (param unused by E2E)     | Observation | fix now | **Applied** (commit `e132f93`): comment trimmed to "mirrors getNotes for testability".                                                      |
| F4  | "cards due now" relies on DB column defaults; no unit assertion locks it           | Observation | dismiss | E2E asserts a gradable card on the dashboard after load — covered.                                                                          |
| F5  | Dump script uses local service-role (read live from `supabase status`)             | Observation | dismiss | Verified benign: dev-only, never imported by app code, emitted fixture carries no keys/user_id/real ids.                                    |

## Companion reviews (parallel fan-out)

- `/tailwind-v4-audit`: **CLEAN** — no pre-v4 syntax, arbitrary values, or inline styles in the 4 UI files.
- `feature-first-structure`: **CLEAN** — deletion test passes (only route→feature wiring + co-located test as expected); zero cross-feature imports; no premature shared-tier promotion; dump-script placement under `supabase/seed-scripts/` is sound.
- `/module-cohesion-audit`: **CLEAN** — 0 violations, 0 splits. `seed-rows.ts` (two functions + one private const) judged cohesive (one concern: seeded-row mutation + its revalidation).
