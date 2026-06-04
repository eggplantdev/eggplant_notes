<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Inline-edit for Notes and Subjects

- **Plan**: `context/changes/inline-edit-notes-and-subjects/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-04
- **Verdict**: REVISE → SOUND (after triage)
- **Findings**: 1 critical, 1 warning, 2 observations — all fixed

## Verdicts

| Dimension             | Verdict (initial) |
| --------------------- | ----------------- |
| End-State Alignment   | WARNING           |
| Lean Execution        | PASS              |
| Architectural Fitness | PASS              |
| Blind Spots           | WARNING           |
| Plan Completeness     | WARNING           |

## Grounding

10/10 paths ✓, symbols ✓, brief↔plan ✓, blast-radius 2/2 ✓ (only `notes/[id]/page.tsx:45` + `subjects/[id]/page.tsx:34` link the `/edit` routes).

## Findings

### F1 — Header rendering in edit mode infeasible as written (duplicate title, both pages)

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness (plan↔code contradiction)
- **Location**: Phase 2 change #1 (and, unflagged, Phase 1 change #1)
- **Detail**: Plan said render the form "in place of the header text — pass a neutral/empty title context." But `PageShell.title` is a required `string` rendered as an unconditional `<h1>` (`page-shell.tsx:16,78-80`); it cannot be emptied/suppressed without a PageShell change. As written → PageShell `<h1>{title}` renders above the form's own title field (duplicate). Hits Phase 1 (notes) too — `notes/[id]/page.tsx:37` feeds the same `<h1>`.
- **Fix ⭐**: In edit mode pass an edit-LABEL title (`"Edit note"`/`"Edit subject"`) to PageShell and render the form as children — exactly what the deleted `/edit` routes do (`edit/page.tsx:18`/`:17`). No duplicate, no PageShell change, preserves the edit-mode signal. Apply to both phases.
- **Decision**: FIXED (Fix ⭐) — Phase 1 & 2 contracts + Critical Implementation Details updated; "no PageShell change" preserved.

### F2 — `actions` slot (Edit/Delete) behavior in edit mode unspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 & 2 change #1
- **Detail**: Plan converts the Edit button to a Cancel link but doesn't say what happens to the PageShell `actions` slot in edit mode. "Edit" is redundant and "Delete" is dangerous mid-edit.
- **Fix**: In edit mode the actions slot shows a single Cancel link; drop Edit and Delete (subjects: also drop New note).
- **Decision**: FIXED — both phase contracts specify the actions-slot swap.

### F3 — Lock the `editId={undefined}` mitigation with a no-redirect E2E

- **Severity**: 🔹 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy / Critical Implementation Details
- **Detail**: The `editId={undefined}` mitigation (verified necessary AND sufficient at `topic-checks-section.tsx:22,25`) is load-bearing; if a refactor forwards `editId={edit}` with `?edit=note`, the section `redirect()`s and silently ejects the user. Test plan covered enter-edit/save but not the no-redirect case.
- **Fix**: Add an E2E assertion that `/notes/[id]?edit=note` does NOT redirect; document `note` as a reserved sentinel.
- **Decision**: FIXED — Testing Strategy + 1.4 progress item + Critical Implementation Details updated.

### F4 — Phase 1 "add getSubjects()" but it's already fetched

- **Severity**: 🔹 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Phase 1 change #1
- **Detail**: Subjects are already fetched on the note detail page (they power the inline `NoteSubjectPicker`). Adding a query is redundant.
- **Fix**: Reword to "reuse the already-fetched subjects."
- **Decision**: FIXED — Phase 1 contract reworded.

## Triage Summary

- **Fixed**: F1 (Fix ⭐), F2, F3, F4 (4)
- **Verdict after fixes**: REVISE → **SOUND**
