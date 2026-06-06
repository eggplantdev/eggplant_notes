# List Search + Pagination — Plan Brief

> Full plan: `context/changes/list-search-pagination/plan.md`

## What & Why

Add real, content-inclusive search and numbered pagination to the list surfaces. Lists full-fetch
today and drag full note/card bodies into payloads they never display — fine at current scale, a
cliff at the 2–3k items a real user will accumulate.

## Starting Point

`getNotes`/`getMemoryCardsList`/`getSubjects` return full arrays with `select('*')`. A working
server-side `SubjectFilter` (`?subjects=`, debounced, URL-driven) already exists and is the template
for search. `getDueQueue` already returns rows + `count:'exact'` — the pagination precedent. No
pagination, no shadcn `pagination` primitive, no virtual scroll.

## Desired End State

`/notes`, `/memory-cards`, `/subjects` read `?q=&subjects=&page=`, run one slim paginated query, and
show a search box + pagination footer; the subtitle count is the total match count. The
`subjects/[id]` sidebar filters its preloaded titles instantly in the browser. List payloads no
longer carry body text.

## Key Decisions Made

| Decision                     | Choice                                 | Why                                                                                                    | Source            |
| ---------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------- |
| Search strategy              | Server-side `?q=` `ilike`              | 2–3k items can't be shipped to the browser to filter                                                   | Frame (change.md) |
| Pagination vs virtual scroll | Numbered pagination                    | Virtual scroll fights `AnimatedCardList` FLIP/`AnimatePresence`; redundant; reference's is table-bound | Frame (change.md) |
| Trigram index                | None                                   | RLS scopes `ilike` to one user's rows; sub-ms at scale                                                 | Frame (change.md) |
| Slim selects                 | Drop body cols from list reads         | Stop shipping `content`/`example`/`code_context`; the real perf win                                    | Plan              |
| `getSubjects` shape          | Keep full-fetch; add `getSubjectsList` | 4 of 5 callers need the full set (filter options, note `<select>`)                                     | Plan              |
| Subjects sidebar             | Client-side in-memory title filter     | Host `layout.tsx` can't read `searchParams`; data preloaded + tiny                                     | Plan              |
| Page size                    | Fixed 24                               | Clean 1/2/3-col grid fill; skip the selector                                                           | Plan              |

## Scope

**In scope:** server search + pagination on the 3 list pages; slim listing selects + lean types;
ported UI/lib utils (`SearchFilterInput`, `PaginationFooter`/`UrlPagination`, `buildUrlWithParams`,
`parsePagination`); `SubjectFilter` page-reset; client-side sidebar title filter; unit + E2E specs.

**Out of scope:** virtual/infinite scroll; trigram index; sidebar pagination; page-size selector;
schema migration; dashboard stats queries.

## Architecture / Approach

Build the presentation-agnostic data layer once — `{rows,total}` via hand-rolled count + slim
select + `ilike .or()` + `.range()` — then port reference UI into shadcn and wire each Server
Component page to read the URL and compose search + footer. The sidebar is the one client-side
filter because its layout can't read the URL and its data is already loaded.

## Phases at a Glance

| Phase             | Delivers                                                            | Key risk                                                                                                 |
| ----------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1. Data layer     | Slim, searchable, paginated `{rows,total}` queries + lean types     | Lean type narrowing must not break `formatReviewStatus`/list components                                  |
| 2. UI & lib ports | `SearchFilterInput`, pagination footer, lib utils, shadcn primitive | Page-reset coupling must land in both search + `SubjectFilter`                                           |
| 3. Wire pages     | 3 pages read URL, render search + footer, subtitle=total            | Cards-overview chart decoupled from list — own full-deck `getCardsForStats()` read (needs `state` added) |
| 4. Sidebar filter | Instant client-side title filter                                    | Filtering must not break active-note highlight                                                           |
| 5. Tests          | Unit + E2E, authored after review/simplify                          | E2E needs >24-row seed                                                                                   |

**Prerequisites:** local Supabase up for E2E; `pnpm dlx shadcn add pagination`.
**Estimated effort:** ~1 slice, 5 phases, no migration.

## Open Risks & Assumptions

- Out-of-range `?page=` (manual deep-link) shows an empty page with a working footer — accepted, no
  redirect/clamp round-trip for MVP.
- Cards-overview chart always reflects the entire deck (ignores `?q`/`?page`/`?subjects`), sourced
  from `getCardsForStats()` (page-refetch, no cache/layout for MVP) — decoupled from the slim list.
- PostgREST `.or()` needs `%`/`,`/parens escaped in `q` — centralized in one builder.

## Success Criteria (Summary)

- A search term found only in a note body / card answer returns that item.
- Search composes with the subject filter and resets to page 1; page links preserve both params.
- The sidebar filters titles instantly with no navigation.
