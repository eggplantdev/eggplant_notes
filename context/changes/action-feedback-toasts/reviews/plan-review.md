<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Action Feedback Toasts

- **Plan**: context/changes/action-feedback-toasts/plan.md
- **Mode**: Deep
- **Date**: 2026-06-04
- **Verdict**: REVISE → SOUND (after triage)
- **Findings**: 0 critical · 2 warnings · 1 observation

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

14/14 paths ✓, symbols ✓ (ActionResultT, `run` seam, DeletedNotice/`?deleted=1`, 10 redirect actions), brief↔plan ✓. Progress↔Phase: 1 `## Progress` ✓, 4/4 phases matched, criteria↔checkboxes ✓.

## Findings

### F1 — Hook API can't drive the optimistic revert it promises to preserve

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — "Migrate bare-useTransition call sites"
- **Detail**: `reorderable-note-list.tsx:91-94` and `note-subject-picker.tsx:43-46` revert optimistic local state (`setItems(previous)` / `setValue(previous)`) on failure. The planned `run(thunk, { successMessage }) → void` owns its own `startTransition` and gives the caller no channel to trigger the revert. Plan said "preserve optimistic revert" without specifying the mechanism; implementer would improvise or silently drop the revert (a regression adjacent to the motivating bug).
- **Fix A**: Add `onError?: () => void` to opts; hook calls it on failure. Keeps single-seam ownership.
- **Fix B ⭐ (chosen)**: `run` returns `Promise<ActionResultT>`; optimistic callers `await run(...)` and revert on `!result.success`. Hook still owns `error`/`isPending`/toasts; only state rollback stays caller-side.
- **Decision**: FIXED (Fix B) — `run` now returns the resolved `ActionResultT`; Phase 2 #1 contract + a new "Optimistic revert" paragraph in Phase 2 #2 specify the await-and-revert pattern and that the picker uses the hook's `isPending`.

### F2 — Phase-4 param strip nukes sibling query params (collides with `?subjects=`)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 — Reader component, "strip the param"
- **Detail**: Contract used `router.replace(pathname)`, dropping the whole query string. `lessons.md` documents an active `?subjects=a,b` notes-list filter; the global reader landing beside it (e.g. `/notes?subjects=…&toast=…`) would lose the filter. No live collision today (deleteNote lands on bare `/notes`) but the latent bug ships with a global reader.
- **Fix**: Strip only `toast` — `const next = new URLSearchParams(searchParams); next.delete('toast'); router.replace(next.size ? \`${pathname}?${next}\` : pathname)`.
- **Decision**: FIXED — Phase 4 reader contract updated.

### F3 — Flag the Phase-4 reader's effect as intentional

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 4 — Reader component
- **Detail**: react.md says "avoid useEffect"; the reader legitimately needs one (toast-once-on-mount-from-URL + strip — a sync-with-external-system effect, the allowed exception). Without a comment, the review/`/simplify` gate would flag/remove it.
- **Fix**: Add a one-line intent comment in the reader (+ the `<Suspense>` note).
- **Decision**: FIXED — folded into the Phase 4 reader note in plan.md.

## Notes

- Did **not** flag `toastMessage`'s 4-arg signature as over-built — `lessons.md` ("don't strip the reference's documented options") makes verbatim mirroring of the `wykonczymy` wrapper correct.
- The uncommitted `z.uuid()`→`z.guid()` schema change in the working tree (parallel session) is orthogonal to this slice — zero file overlap with the toast call sites; no reconciliation needed.
