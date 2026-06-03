<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Capture a Note with Code (S-01)

- **Plan**: context/changes/capture-note-with-code/plan.md
- **Scope**: All 4 phases
- **Date**: 2026-06-03
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — getNotes() is unbounded and over-fetches full content

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Performance)
- **Location**: src/features/notes/queries.ts:14
- **Detail**: `getNotes()` does `select('*').order('created_at')` with no `.limit()`. The list page renders only title + created_at, but this pulls every note's full markdown `content`. Unbounded row count + per-row blob over-fetch. Inherited from F-02; S-01's list page is the first consumer.
- **Fix**: Narrow to `.select('id, title, created_at').limit(50)` (or `.range()` for pagination) and give the list its own row type. Edits an F-02 file.
- **Decision**: DEFERRED — pagination is coming in a later stage; the unbounded select + content over-fetch will be addressed then, together with proper `.range()` pagination rather than a stopgap `.limit()`. Tracked in `follow-ups/review-fixes.md`.

### F2 — Two unplanned changes rode in with S-01

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/app/(protected)/dashboard/page.tsx:19 ; eslint.config.mjs:39
- **Detail**: (b) dashboard "Notes" link and (c) eslint `.claude/**` ignore are both EXTRA (not in plan). Both benign and defensible: the link makes the feature reachable (doesn't touch S-04 dashboard logic), the ignore fixes lint contamination from a sibling worktree's `.next`.
- **Fix**: Accept as-is (already committed, both justified). No code change.
- **Decision**: ACCEPTED — both extras justified; no change.

### F3 — Markdown raw-HTML safety is comment-only

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Security)
- **Location**: src/features/notes/render-markdown.tsx
- **Detail**: Currently SAFE — react-markdown escapes raw HTML (no rehype-raw). But the property is only protected by a code comment. A future change adding rehype-raw silently turns this into stored XSS.
- **Fix**: Record a lesson + optionally a test asserting injected `<script>`/HTML is escaped.
- **Decision**: FIXED — added E2E guard `note body raw HTML is rendered inert, not executed (no stored XSS)` to `e2e/notes.spec.ts` (asserts no live script/img, handlers don't run, markup survives as escaped text). 9/9 e2e green.

### F4 — Editor theme hardcoded to dark

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/features/notes/code-mirror-editor.tsx:31
- **Detail**: `theme="dark"` is hardcoded. Correct today (app shell is forced dark in layout.tsx, no toggle), and the Shiki detail render IS dual-theme. If a light theme/toggle ships later, the editor surface alone stays dark.
- **Fix**: Leave as-is until a theme toggle exists; revisit then.
- **Decision**: SKIPPED — matches the always-dark shell; revisit when a theme toggle ships.

### F5 — Import-order nit in delete-note-button.tsx

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/features/notes/delete-note-button.tsx:16
- **Detail**: Orders `@/components/ui/button` before `forms/form-error`; the rest of the repo sorts `forms` before `ui`. Cosmetic — Prettier doesn't sort imports.
- **Fix**: Reorder the two import lines to match convention.
- **Decision**: FIXED — reordered to forms-before-ui in delete-note-button.tsx.
