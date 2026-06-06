<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: List Search + Pagination

- **Plan**: context/changes/list-search-pagination/plan.md
- **Scope**: Phases 1–4 of 5 (Phase 5 test layer pending by design — authored after the review→/simplify gate)
- **Date**: 2026-06-06
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension           | Verdict                                                   |
| ------------------- | --------------------------------------------------------- |
| Plan Adherence      | PASS                                                      |
| Scope Discipline    | PASS                                                      |
| Safety & Quality    | PASS                                                      |
| Architecture        | PASS                                                      |
| Pattern Consistency | PASS                                                      |
| Success Criteria    | PASS (automated only; manual + Phase 5 pending by design) |

## Findings

### F1 — Out-of-range page garbles the footer "Showing X–Y" range

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/ui/pagination-footer.tsx:19-20
- **Detail**: The plan explicitly accepted out-of-range deep-links (`?page=99`) as "empty rows + a working footer to navigate back" with no clamp/redirect (plan.md:79-81). But `parsePagination` clamps only the LOWER bound (`page >= 1`); an upper-overflow page flows through unclamped. The footer computes `from = (currentPage - 1) * limit + 1` against that raw page, so with total=30, limit=24, page=99 it renders "Showing 2353–30 of 30" — from > to, from > total. Page links still work (getWindowedPages(99, 2) → [1,2]), so the "navigate back" guarantee holds; only the range string is broken. The accepted-risk note covered empty rows + a working footer, not the garbled summary text.
- **Fix**: Clamp the displayed range in the footer without a redirect: `const from = totalDocs === 0 ? 0 : Math.min((currentPage - 1) * limit + 1, totalDocs)`, keep `to = Math.min(currentPage * limit, totalDocs)`. Pure presentational guard; preserves the no-redirect MVP decision. (Clamping `currentPage` to `totalPages` in buildPaginationMeta is heavier — changes active-page highlight + prev/next disabled logic — not recommended.)
- **Decision**: PENDING

### F2 — searchOr deviates from the plan's stated escape set (justified, but undocumented in-plan)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to confirm the security claim
- **Dimension**: Plan Adherence
- **Location**: src/lib/supabase/search-filter.ts:13-18
- **Detail**: Plan contract said `.or('title.ilike.%q%,content.ilike.%q%')` "escape `%`/`,`" and "escape PostgREST special chars (`%`, `,`, `(`, `)`) identically" (plan.md:101, 156-160). Implementation instead WRAPS the term in double quotes (`col.ilike."%term%"`) and backslash-escapes only `"`/`\`. This is a SOUNDER mechanism than per-char escaping, not a defect: PostgREST treats a double-quoted value as literal, so `,` `.` `(` `)` inside user text are no longer structural — confirmed against PostgREST/Supabase docs (double-quoting reserved chars in `.or()` is the documented injection-safe approach) and the file comment notes empirical verification. `%`/`_` are intentionally left live as ilike wildcards (acceptable for a search box, documented). No injection vector; the deviation is an improvement. The only gap is the plan still records the weaker per-char approach as the contract — a future plan-vs-code diff shows an unexplained mismatch.
- **Fix**: One-line addendum in plan.md (step 6 contract) noting the final mechanism is double-quote-wrapping (literalizes `,.()`), not per-char escaping. No code change.
- **Decision**: PENDING

### F3 — `page > 1` omit logic is duplicated across three files, but consistent

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/ui/url-pagination.tsx:41
- **Detail**: The "page 1 omits the param" rule lives in three agreeing places: parsePagination defaults to 1 (pagination.ts:21-22), UrlPagination's `pageUrl` passes `page > 1 ? String(page) : ''` (url-pagination.tsx:41), buildUrlWithParams deletes empty-string keys (build-url-with-params.ts:13). Consistent and correct — a page-1 link yields a clean `/notes` URL per the URL contract (change.md:57). Flagged only because the invariant is spread across three files; a future edit to one must keep the others in step.
- **Fix**: None. Working as designed.
- **Decision**: PENDING

### F4 — Cards-overview empty-deck branch differs from list empty-state (intended)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/app/(protected)/memory-cards/page.tsx:46-50
- **Detail**: The "Cards overview" card renders on `statsCards.length > 0` (whole-deck count), while the list/search block renders on `total > 0 || isFiltered` (filtered count). Correct and matches the decoupling (chart = whole-deck, list = filtered): a user filtered to zero matches still sees the overview for their full deck plus a "No memory cards match" empty state. Intended; noted because two count sources on one page can be misread as a bug later.
- **Fix**: None. Confirmed against plan intent (plan.md:280-286).
- **Decision**: PENDING

### F5 — Sidebar drag-disabled-while-filtering is correct and well-guarded

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/features/subjects/components/subject-note-sidebar.tsx:165-196, 239-243
- **Detail**: While a title filter is active the sidebar swaps the sortable list for a static FilteredNoteList (drag off). Rationale is sound and documented inline: dragging a filtered subset would compute fractional positions against the wrong neighbors (hidden rows between two visible ones). `filtering = trimmed.length > 0` drives the swap; clearing restores the draggable full list and the active-note highlight (activeNoteId derives from pathname, independent of the filter). Nuance (not a bug): `visible` derives from optimistic `items`, but reorder is disabled during filtering so there's no conflict. Aligns with the dnd-kit listitem-role lesson (grip carries listeners, not the row).
- **Fix**: None. Working as designed.
- **Decision**: PENDING
