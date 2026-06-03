<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Attach Topic Checks (S-02)

- **Plan**: context/changes/attach-topic-checks/plan.md
- **Scope**: All 4 phases
- **Date**: 2026-06-03
- **Verdict**: APPROVED
- **Findings**: 0 critical · 2 warnings · 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | WARNING |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Critical invariants verified: mutations never send `user_id` or any SM-2 column · blank
optionals coerce to SQL `null` · delete cascades to `review_events` at the DB · content renders
via rehype-raw-free Shiki (XSS inert) · the 3 approved plan deviations (searchParams `?edit`,
`(noteId, id, …)` action signatures, PostgREST-shape isolation assertion) are soundly
implemented — notably `key={editId ?? 'new'}` correctly substitutes for the planned client-state
reset.

## Findings

### F1 — Unbounded per-note read (select('\*'), no limit)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Performance)
- **Location**: src/features/topic-checks/queries.ts:32 (getTopicChecksForNote)
- **Detail**: `select('*')` with no `.limit()`/pagination, pulling full `code_context` blobs for
  every check and rendering each through server-side Shiki. Same class as the deferred S-01 F1
  (notes list over-fetch). Not critical at personal MVP scale, but the same unbounded-query smell.
- **Fix**: Defer explicitly into follow-ups/review-fixes.md alongside the S-01 F1 pagination item
  (recommended), or add a sane `.limit()`.
- **Decision**: DEFERRED → follow-ups/review-fixes.md

### F2 — Cross-feature imports from notes (promotion debt)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: topic-check-form.tsx:18-19 (NoteEditor, MarkdownPreview); topic-checks-section.tsx:4 + page.tsx:7 (RenderMarkdown)
- **Detail**: The feature-first promotion rule has fired — RenderMarkdown, MarkdownPreview,
  NoteEditor now have a confirmed 2nd consumer (notes + topic-checks). They're genuinely
  non-domain markdown primitives (NoteEditor is misnamed for shared use). Works and type-resolves;
  structural debt, not a defect.
- **Fix A ⭐ Recommended**: Defer — log as an explicit promotion follow-up.
  - Strength: Keeps S-02 scope tight; promotion touches S-01 files + needs a re-test, better as its own change.
  - Tradeoff: Debt lives longer; a 3rd consumer would worsen it.
  - Confidence: HIGH — matches how S-01's F1 was deferred.
  - Blind spot: None significant.
- **Fix B**: Promote now to src/components/markdown/ (+ rename NoteEditor).
  - Strength: Pays the debt at the moment the rule fired.
  - Tradeoff: Scope creep into archived-adjacent S-01 code; re-test notes + E2E.
  - Confidence: MEDIUM — rename has wider blast radius than it looks.
  - Blind spot: Other importers not re-counted.
- **Decision**: FIXED via Fix B — promoted RenderMarkdown / MarkdownPreview / MarkdownEditor (was NoteEditor) / CodeMirrorEditor to `src/components/markdown/`; all 4 importers re-pointed; typecheck/lint/build green.

### F3 — Stale ?edit id silently falls back to create mode

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; narrowly scoped
- **Dimension**: Reliability
- **Location**: topic-checks-section.tsx:21 (checks.find on editId)
- **Detail**: If `?edit=<id>` points at a just-deleted / non-owned check, `editingCheck` is
  undefined → form shows "Add" while the URL still says `?edit=`. No crash, no wrong-row edit (the
  key remount is correct). Mildly confusing UX only.
- **Fix**: Optional — if `(editId && !editingCheck)` strip the param or `notFound()`. Low priority.
- **Decision**: FIXED — `topic-checks-section.tsx` redirects to `/notes/${noteId}` (strips stale `?edit`).

### F4 — No stored-XSS guard in topic-checks E2E

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: e2e/topic-checks.spec.ts
- **Detail**: notes.spec.ts has an explicit "raw HTML rendered inert" test; topic-checks.spec.ts
  doesn't. Topic-check content flows through the same rehype-raw-free RenderMarkdown, so the
  protection exists — but no red-on-regression guard if someone adds rehype-raw.
- **Fix**: Optional — add a one-line inert-HTML assertion mirroring notes.spec.ts. Low value
  (identical, already-guarded path).
- **Decision**: SKIPPED — identical already-guarded RenderMarkdown path; notes.spec guard covers the regression risk.
