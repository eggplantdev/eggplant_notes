---
change_id: list-search-pagination
title: Server-side search + pagination across notes, memory cards, and subjects
status: impl_reviewed
created: 2026-06-06
updated: 2026-06-06
archived_at: null
---

## Notes

Add real, content-inclusive search + numbered pagination to the list surfaces. Approved
design (brainstormed 2026-06-06):

### Scope — four surfaces

- `/notes`, `/memory-cards`, `/subjects` — search box + numbered pagination.
- `/subjects/[id]` note sidebar — search box, **no** pagination (slim id/title nav; paging it is awkward UX).

### Strategy decision

Server-side `?q=` search, not client-side in-memory filtering — a user may have thousands of
notes/cards, so shipping the full table to the browser to filter is out. Search and pagination
are inseparable: a paged set can only be searched at the DB.

**Virtual scroll rejected for this slice** (it was floated). Reasons: (1) the reference repo's
virtualizer is `@tanstack/react-table`-bound, not reusable for our `AnimatedCardList` grids;
(2) virtualizing a responsive multi-column grid is the hard case; (3) it fights `AnimatedCardList`
— FLIP (`layout`/`layoutId`) and the virtualizer both author `transform`, and mount-on-scroll
re-fires the enter animation; (4) redundant with pagination at a sane page size. Pagination
sidesteps all of it. Keep virtual scroll a separate future item if ever needed.

### Data layer (built once, presentation-agnostic)

`getNotes` / `getMemoryCardsList` / `getSubjects` gain:
`opts?: { subjectIds?: string[]; q?: string; page?: number; limit?: number }`
returning `{ rows, total }`.

- Search: `q` → `.or(...)` of `ilike` across that entity's text columns:
  - notes → `title`, `content`
  - memory_cards → `prompt`, `example`, `code_context` (the "answer" side; no single answer col)
  - subjects → `title`, `description`
- Pagination: `.range(offset, offset+limit-1)` + `{ count: 'exact' }` in one round-trip (same
  trick `getDueQueue` already uses).
- `q` AND `subjectIds` compose — search runs _within_ selected subjects. Reuse the existing
  `?subjects=` param untouched.
- RLS already scopes rows to the owner; search only ever scans one user's set.

### No trigram index this slice

RLS narrows `ilike` to a single user's hundreds-to-low-thousands of rows → seq scan is
sub-ms. The reference indexed a shared, un-scoped table; we don't have one. Add `pg_trgm`
later only if a real user's set proves slow. (Only deliberate deviation from the reference.)

### URL contract

`?q=<term>&subjects=<a,b>&page=<n>`. Page 1 omits `page`. Changing `q` or `subjects` resets to
page 1 (mirror reference's `page: ''` reset in `buildUrlWithParams`).

### UI — port from wykonczymy reference into this repo's shadcn

- `SearchFilterInput` (debounced, lucide Search icon) → `src/components/ui/`. Writes `?q=` via
  `router.replace(..., { scroll: false })` — same shape as the existing `SubjectFilter`.
- `PaginationFooter` + `UrlPagination` → `src/components/ui/`; `buildUrlWithParams`,
  `parsePagination`/`buildPaginationMeta` → `src/lib/`.
- Pages stay Server Components: read `searchParams`, call the query, render `AnimatedCardList`
  (untouched) + `<PaginationFooter>`. `PageShell` subtitle count reads `total`, not `rows.length`.
- Page size: 24 (clean 1/2/3-col grid fill). Skip the limit selector for MVP.

### Sequencing

One vertical slice. No migration. Touches query layer + 4 routes + shared UI ports. Fits before
the 2026-06-10 deadline.
