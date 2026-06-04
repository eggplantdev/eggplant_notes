# S-15 subject-sidebar-nav — slice review gate record

Date: 2026-06-04. Reviewed all 3 phases (scoped to S-15 files; a parallel session's
`daily-goal-progress-bar` work is interleaved on the same branch and was excluded).

## Fan-out verdicts

| Review                    | Verdict                                                                                                                                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/10x-impl-review`        | NEEDS ATTENTION — 0 critical, 3 low warnings, 2 observations (see below)                                                                                                                                                                       |
| `/tailwind-v4-audit`      | CLEAN — 0 violations (dnd runtime `transform` inline style + `md:max-h-[calc(100dvh-6rem)]` are justified carve-outs)                                                                                                                          |
| `feature-first-structure` | PASS — deletion test clean (no orphans after removing `reorderable-note-list.tsx` + `getNotesForSubject`); no cross-feature deep imports; shared edits (`page-shell` `backHistory`, `delete-note` `redirectTo`) correctly placed/parameterized |
| `/module-cohesion-audit`  | 1 finding — `NoteSummaryT` exported from a component file + duplicated the query's `Pick<NoteT,…>` return                                                                                                                                      |

## impl-review findings + triage

- **F1 — fractional-position tie/precision degeneracy (now the sole reorder path).** Inherited from the deleted `ReorderableNoteList`; documented "accepted" in `midpoint.ts`. → **Skip** (pre-existing, MVP).
- **F2 — comment implied a local `<ActionToast>` reader.** → **Fixed** in `/simplify` (reworded to the global one in the root layout).
- **F3 — `position` in the titles-only query.** Not over-fetch — load-bearing for the midpoint math. → **Dismiss**.
- **F4 — `reorderNote` widened `page`→`layout` revalidate.** Required now the sidebar lives in the layout. → **Dismiss** (correct).
- **F5 — keyboard reorder dropped; no keyboard reorder anywhere now.** Intended a11y tradeoff (grip not tab-focusable; arrow-key nav between links instead). → **Skip** (a11y backlog).
- **C1 (cohesion + feature-first) — `NoteSummaryT` leak + duplicate.** → **Fixed** in `/simplify`: collapsed onto `SubjectNoteSummaryT` in `features/subjects/types.ts`; `getSubjectNoteSummaries` return is the single source of truth.

## `/simplify` applied

- `features/subjects/types.ts` (new) — `SubjectNoteSummaryT = Pick<NoteT,'id'|'title'|'position'>`; consumed by the query + sidebar.
- Reworded the `?toast` comment in `subjects/[id]/page.tsx`.

## Tests authored (post-simplify)

- Unit: `src/__tests__/midpoint.test.ts` (5/5).
- E2E: rewrote `e2e/subjects.spec.ts` for the docs view (open→first note, sidebar nav + active highlight, handle-drag reorder, delete-detach, `?edit` rename, isolation/F1).

## Suite

typecheck ✓ · lint ✓ · vitest 42/42 ✓ · build ✓ · **e2e skipped by operator**.

## Deferred follow-ups

- `/subjects/[id]/<non-uuid>` → `getNote` throws on the uuid cast (500, not a clean 404). Cheap guard (validate noteId shape → `notFound()`) deferred — correctness/polish, out of this slice.
- True instant-revisit caching → **S-11** (Cache Components / Router Cache).
- Keyboard reorder accessibility → a11y backlog.
