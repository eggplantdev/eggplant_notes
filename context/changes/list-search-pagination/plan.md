# List Search + Pagination Implementation Plan

## Overview

Add real, content-inclusive **server-side search** and **numbered pagination** to the three list
surfaces (`/notes`, `/memory-cards`, `/subjects`), a **client-side title filter** to the
`subjects/[id]` note sidebar, and **slim the listing queries** to the columns each list actually
renders (dropping note bodies / card answer text from list payloads). No schema migration.

## Current State Analysis

- All list queries full-fetch and return arrays: `getNotes` / `getMemoryCardsList` /
  `getSubjects` (`src/features/*/queries.ts`). Each is commented "personal-scale, fetching all
  rows is fine." No pagination exists anywhere.
- `getNotes` selects `*, subjects(title)` — `*` drags the full `content` body into every list
  row though the list shows only title/subject/date. `getMemoryCardsList` selects `*` — drags
  `example`/`code_context` answer text. This over-fetch is harmless today, costly at scale.
- A working server-side filter pattern already exists: `SubjectFilter`
  (`src/features/subjects/components/subject-filter.tsx`) — debounced, URL-driven via
  `router.replace(..., {scroll:false})`, two-mode (open=local, closed=URL). `?subjects=a,b`
  re-queries the page server-side. Search will mirror this shape.
- `getDueQueue` already hand-rolls a query that returns **both** rows and `count:'exact'` off one
  response — the precedent for paginated `{rows,total}`, since `runTableQuery`
  (`src/lib/supabase/run-table-query.ts`) returns rows only and throws on null.
- The `subjects/[id]` note sidebar is rendered in `layout.tsx`; **Next layouts cannot read
  `searchParams`**, so a server `?q=` cannot drive it. The sidebar already receives the full slim
  `getSubjectNoteSummaries` set (id/title/position, dozens of rows).
- The reference repo `wykonczymy` (`/Users/konradantonik/workspace/yolo/wykonczymy`) has portable
  components: `SearchFilterInput`, `UrlPagination`, `PaginationFooter`, `buildUrlWithParams`,
  `parsePagination`/`buildPaginationMeta`, `getWindowedPages`. Its virtualizer is table-bound and
  NOT ported (virtual scroll rejected — see change.md).
- No shadcn `pagination` primitive in `src/components/ui/` yet; `input.tsx` is present.

## Desired End State

Each list page reads `?q=&subjects=&page=` from `searchParams`, runs one slim paginated query, and
renders a search box + a pagination footer; the `PageShell` subtitle count reflects the total
match count, not the current page length. The subjects sidebar filters its preloaded titles in the
browser as you type. Verify: with >24 seeded rows, the list shows 24 + working page links; typing a
term that matches only body `content`/answer text narrows results; search composes with the subject
filter; the sidebar filters titles instantly without a navigation.

### Key Discoveries:

- `getDueQueue` (`src/features/memory-cards/queries.ts`) is the count+rows precedent — hand-roll the
  three paginated queries the same way; do not route them through `runTableQuery`.
- `getSubjects` has **5 callers**; four need the full set (filter options + the note `<select>` on
  `notes/new` and `notes/[id]`). It must NOT change shape — add a separate `getSubjectsList`.
- `formatReviewStatus` (`src/features/memory-cards/utils/format-review-status.ts`) reads only
  `state` + `due_at` — so the slim card select must keep both.
- `SubjectFilter.commit()` builds the URL from current params; once `page` exists it must also
  delete `page` on commit, else a subject change strands you on a now-empty deep page.

## What We're NOT Doing

- No virtual scroll / infinite scroll (rejected in change.md — fights `AnimatedCardList`'s
  FLIP/`AnimatePresence`, redundant with pagination).
- No `pg_trgm` trigram index — RLS scopes `ilike` to one user's rows; add later only if proven slow.
- No pagination on the `subjects/[id]` sidebar (client-side title filter only).
- No page-size selector (fixed 24).
- No schema migration.
- No changes to `getNotesForStats` / `getCardsForStats` (dashboard stats — separate lean reads).

## Implementation Approach

Build the presentation-agnostic data layer once (`{rows,total}` via hand-rolled count + slim
selects + `ilike` search + `.range()`), port the reference UI/lib utilities into this repo's
shadcn, then wire each Server Component page to read the URL and compose search + footer. The
sidebar is the lone client-side filter because its host layout can't read the URL and its data is
already fully loaded and tiny.

## Critical Implementation Details

**Page-reset coupling.** Changing `q` or `subjects` must reset `page` to 1 (drop the param). Both
`SearchFilterInput`'s commit and `SubjectFilter`'s existing `commit()` must delete `page`. This is
the one cross-component invariant — miss it and a filter change strands the user on an out-of-range
page.

**Out-of-range page (deep-link `?page=99`).** `parsePagination` clamps `page` to `>= 1`; an upper
overflow returns empty rows with `total > 0`. The footer still renders (computed from `total`), so
the user can navigate back. Acceptable for MVP — do not add a redirect/clamp round-trip.

## Phase 1: Data layer — slim, paginate, search

### Overview

Turn the three list queries into slim, searchable, paginated reads returning `{ rows, total }`.

### Changes Required:

#### 1. Notes query

**File**: `src/features/notes/queries.ts`

**Intent**: Slim `getNotes` to the columns the list renders, add `q` search across `title`+`content`,
add `page`/`limit` pagination, return `{ rows, total }`. Keep the injectable-client signature for
isolation tests.

**Contract**: `getNotes(opts?: { subjectIds?: string[]; q?: string; page?: number; limit?: number },
client?) → Promise<{ rows: NoteListItemT[]; total: number }>`. Select `id, title, created_at,
subjects(title)`. Search: `.or('title.ilike.%q%,content.ilike.%q%')` (escape `%`/`,` in `q`).
Compose `.in('subject_id', subjectIds)` AND search. Hand-roll `{ count: 'exact' }` + `.range()`
like `getDueQueue` (not `runTableQuery`). Order `created_at desc`.

#### 2. Notes list-item type

**File**: `src/features/notes/types.ts`

**Intent**: Narrow `NoteListItemT` to the slim projection so the type matches the new select.

**Contract**: `NoteListItemT = Pick<NoteT, 'id' | 'title' | 'created_at'> & { subjects: { title: string } | null }`.

#### 3. Memory-cards query

**File**: `src/features/memory-cards/queries.ts`

**Intent**: Same treatment for `getMemoryCardsList` — slim select, search across
`prompt`+`example`+`code_context`, paginate, return `{ rows, total }`.

**Contract**: `getMemoryCardsList(opts?: { subjectIds?: string[]; q?: string; page?: number;
limit?: number }, client?) → Promise<{ rows: MemoryCardListItemT[]; total: number }>`. Select `id,
prompt, note_id, due_at, state, notes!inner(title, subjects(title))`. Search `.or(...)` over
`prompt,example,code_context`. Subject filter stays `.in('notes.subject_id', subjectIds)` (inner
join). Hand-rolled count + `.range()`, order `due_at asc`.

#### 4. Memory-card list-item type

**File**: `src/features/memory-cards/types.ts`

**Intent**: Narrow `MemoryCardListItemT` to the slim projection (`id, prompt, note_id, due_at,
state` + embed). Drops `stability` — so `CardsOverview` can no longer consume the list type; it
moves to the stats read (step 7). Confirm `formatReviewStatus` still type-checks (needs
`state`,`due_at`).

**Contract**: `MemoryCardListItemT = Pick<MemoryCardT, 'id'|'prompt'|'note_id'|'due_at'|'state'> &
{ notes: { title: string | null; subjects: { title: string } | null } | null }`.

#### 5. Subjects list query (new)

**File**: `src/features/subjects/queries.ts`

**Intent**: Add `getSubjectsList` for the subjects list page — slim, searchable, paginated. Leave
`getSubjects()` (5 callers need the full set) untouched.

**Contract**: `getSubjectsList(opts?: { q?: string; page?: number; limit?: number }, client?) →
Promise<{ rows: SubjectListItemT[]; total: number }>`. Select `id, title, description, created_at`.
Search `.or('title.ilike.%q%,description.ilike.%q%')`. Hand-rolled count + `.range()`, order
`created_at desc`. Add `SubjectListItemT` to `src/features/subjects/types.ts` (`Pick<SubjectT,
'id'|'title'|'description'|'created_at'>`).

#### 6. Shared search-filter builder

**File**: `src/features/notes/queries.ts` (or a small `src/lib/supabase/` helper if reused cleanly)

**Intent**: Centralize the `q` → escaped `.or(col.ilike.%q%, …)` construction so all three queries
escape PostgREST special chars (`%`, `,`, `(`, `)`) identically.

**Contract**: `searchOr(columns: string[], q: string): string | null` returning the `.or()` arg or
`null` when `q` is blank. All three list queries will import it, so it's born shared in
`src/lib/supabase/` (2nd-consumer rule already satisfied) — not held in `notes/queries.ts`.

#### 7. Cards-overview stats source

**File**: `src/features/memory-cards/queries.ts`

**Intent**: Decouple the chart from the paginated list. The chart reflects the **entire deck**
(ignores `?q`/`?page`/`?subjects`), so it can't read the paginated `rows`. Source it from the
existing full-deck lean read `getCardsForStats` — which today selects `id, prompt, note_id, due_at,
stability, lapses` but **not `state`**, which the chart needs (`cards-overview.tsx:17`). Add `state`
to that select. No new query, no DB aggregate (PostgREST can't `GROUP BY`; a lean fetch-all + TS
reduce is sub-ms at personal scale).

**Contract**: `getCardsForStats` select becomes `id, prompt, note_id, due_at, state, stability,
lapses`. Return shape unchanged otherwise.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- A query returns 24 rows + a `total` larger than 24 against a >24-row seeded account.
- A term present only in a note's `content` (not title) returns that note.
- Slim payload confirmed: list responses no longer include `content`/`example`/`code_context`.

**Implementation Note**: After automated verification passes, pause for manual confirmation before
the next phase.

---

## Phase 2: Shared UI & lib ports

### Overview

Port the reference's search/pagination primitives into this repo's shadcn + lib tiers.

### Changes Required:

#### 1. shadcn pagination primitive

**File**: `src/components/ui/pagination.tsx` (generated)

**Intent**: Add the shadcn pagination primitive the footer builds on.

**Contract**: `pnpm dlx shadcn@latest add pagination`.

#### 2. URL param + pagination lib utils

**File**: `src/lib/utils/build-url-with-params.ts`, `src/lib/utils/pagination.ts`

**Intent**: Port `buildUrlWithParams` (empty value deletes key) and `parsePagination` /
`buildPaginationMeta` / `DEFAULT_LIMIT` from the reference, adjusted to a fixed limit of 24.

**Contract**: `buildUrlWithParams(baseUrl, currentParams, overrides) → string`;
`parsePagination(searchParams) → { page, limit }` with `DEFAULT_LIMIT = 24`; `PaginationMetaT` +
`buildPaginationMeta`.

#### 3. SearchFilterInput

**File**: `src/components/ui/search-filter-input.tsx`

**Intent**: Debounced search box writing `?q=` via `router.replace(..., {scroll:false})`, mirroring
`SubjectFilter`'s commit shape; **deletes `page` on commit**. Uses existing `input.tsx` + lucide
`Search`.

**Contract**: Self-contained client component reading `usePathname`/`useSearchParams`/`useRouter`;
prop `placeholder?`. Debounce ~400ms (match `SubjectFilter`'s `DEBOUNCE_MS`). Clears timer on
unmount.

#### 4. UrlPagination + PaginationFooter + getWindowedPages

**File**: `src/components/ui/url-pagination.tsx`, `src/components/ui/pagination-footer.tsx`,
`src/components/ui/get-windowed-pages.ts`

**Intent**: Port the reference's windowed page links + footer (results count + page nav), built on
the shadcn primitive and `buildUrlWithParams`. Drop the reference's page-size `<Select>` (fixed 24).
English copy, not Polish.

**Contract**: `PaginationFooter({ paginationMeta, baseUrl })`; renders nothing when `totalPages <=
1`. `getWindowedPages(currentPage, totalPages)` returns the visible page window.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- Footer renders page links for a 50-row set, hides at <=24 rows.
- Typing in the search box updates `?q=` without a full-page scroll jump.

---

## Phase 3: Wire the list pages

### Overview

Compose search + footer into the three Server Component pages; fix the page-reset coupling.

### Changes Required:

#### 1. Notes page

**File**: `src/app/(protected)/notes/page.tsx`

**Intent**: Read `q`/`page` from `searchParams`, pass to `getNotes`, render `SearchFilterInput` +
`PaginationFooter`, set subtitle from `total`.

**Contract**: `searchParams: Promise<{ subjects?: string; q?: string; page?: string }>`. Destructure
`{ rows, total }`. `pluralize(total, 'note')`. `baseUrl="/notes"`.

#### 2. Memory-cards page

**File**: `src/app/(protected)/memory-cards/page.tsx`

**Intent**: Same wiring for `getMemoryCardsList` (the paginated list). Separately fetch
`getCardsForStats()` (full deck — ignores `?q`/`?page`/`?subjects`) and pass it to `CardsOverview`;
the paginated `rows` now drive **only** the list. Plain page-refetch for MVP — the stats read is a
sub-ms lean scan and always correct; revisit a layout-hosted fetch only if it shows in a trace.
`CardsOverview`'s prop changes from `MemoryCardListItemT[]` to the stats row shape (needs
`state`+`stability`). `baseUrl="/memory-cards"`.

**Contract**: As notes; subtitle `pluralize(total, 'memory card')`. Page awaits both reads (can
`Promise.all`). `CardsOverview` prop: `cards: Pick<MemoryCardT, 'state'|'stability'>[]`.

#### 3. Subjects page

**File**: `src/app/(protected)/subjects/page.tsx`

**Intent**: Switch to `getSubjectsList`, add `searchParams`, render search + footer, subtitle from
`total`. `baseUrl="/subjects"`.

**Contract**: `searchParams: Promise<{ q?: string; page?: string }>`; subtitle
`pluralize(total, 'subject')`.

#### 4. SubjectFilter page-reset

**File**: `src/features/subjects/components/subject-filter.tsx`

**Intent**: In `commit()`, also `params.delete('page')` so a subject change returns to page 1.

**Contract**: One-line addition in `commit`; no behavior change when no `page` param present.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Build passes: `pnpm build`

#### Manual Verification:

- Search + subject filter compose (search within selected subjects).
- Changing search or subject filter resets to page 1.
- Empty-state copy still distinguishes "no items" vs "no matches".
- Pagination preserves `q` + `subjects` across page links.

---

## Phase 4: Subject sidebar client-side title filter

### Overview

Add an instant client-side title filter to the `subjects/[id]` note sidebar (layout can't read
`searchParams`; data is preloaded and tiny).

### Changes Required:

#### 1. Sidebar search

**File**: the sidebar component rendered by `src/app/(protected)/subjects/[id]/layout.tsx` (the
`getSubjectNoteSummaries` consumer)

**Intent**: Add a `SearchFilterInput`-style box (local state, no URL) filtering the preloaded
summaries by title via an in-memory `includes` match. No server round-trip, no pagination.

**Contract**: Client component holding `searchTerm` state; filters `summaries` by
`title.toLowerCase().includes(term)`. Reuse the reference's `useSearchFilter` shape if it earns a
second consumer; otherwise inline. `getSubjectNoteSummaries` is unchanged.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- Typing filters the sidebar list instantly with no navigation/flicker.
- Clearing the box restores the full list; active-note highlight still works.

---

## Phase 5: Test layer

### Overview

Authored **last**, after the review→`/simplify` gate (per CLAUDE.md), so specs lock in the
cleaned-up code.

### Changes Required:

#### 1. Unit specs

**File**: `src/__tests__/pagination.test.ts`, `src/__tests__/build-url-with-params.test.ts`

**Intent**: Cover `parsePagination` (defaults, clamp `page>=1`, invalid limit → default) and
`buildUrlWithParams` (override, empty-value delete, page reset).

**Contract**: Vitest specs under `src/__tests__/**`.

#### 2. E2E specs

**File**: `e2e/list-search.spec.ts` (+ extend `e2e/notes-subject-filter.spec.ts` if natural)

**Intent**: Per surface — seed >24 rows, assert page 1 shows 24 + footer; search by a body-only
term narrows; search composes with subject filter; page links preserve params; sidebar title filter
works. Self-seed via real sign-up per `e2e/helpers.ts` (no DB reset).

**Contract**: Playwright specs under `e2e/**`; system Chrome, isolated port/build per AGENTS.md.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `pnpm test`
- E2E pass (local Supabase up): `pnpm test:e2e`
- Type/lint/build pass: `pnpm typecheck` && `pnpm lint` && `pnpm build`

#### Manual Verification:

- Full suite green before archive.

---

## Testing Strategy

### Unit Tests:

- `parsePagination`: default page/limit, `page < 1` clamps to 1, non-allowed limit → default.
- `buildUrlWithParams`: merge override, empty string deletes key, `page` reset on `q`/`subjects`.

### Integration Tests (E2E):

- Notes/cards/subjects: page-1 cap at 24, footer presence, body-term search, filter composition,
  param preservation across pages.
- Subjects sidebar: instant in-memory title filter.

### Manual Testing Steps:

1. Seed an account with >24 notes (some with a unique word only in the body).
2. Visit `/notes`, confirm 24 shown + footer; search the body-only word → that note appears.
3. Apply a subject filter + search together; confirm AND semantics and page reset.
4. Open a subject with many notes; filter the sidebar by title.

## Performance Considerations

Slim selects remove note/card body text from list payloads — the main win at 2–3k rows. `ilike`
under RLS scans only one user's rows; sub-ms at personal scale, so no trigram index. One round-trip
per page via `count:'exact'`.

## Migration Notes

None — no schema change.

## References

- Change identity + approved design: `context/changes/list-search-pagination/change.md`
- Count+rows precedent: `src/features/memory-cards/queries.ts` (`getDueQueue`)
- Filter pattern: `src/features/subjects/components/subject-filter.tsx`
- Reference components: `/Users/konradantonik/workspace/yolo/wykonczymy/src/components/ui/{search-filter-input,url-pagination,pagination-footer}.tsx`, `src/lib/{pagination,build-url-with-params}.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data layer — slim, paginate, search

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck`
- [x] 1.2 Linting passes: `pnpm lint`

#### Manual

- [ ] 1.3 24 rows + total > 24 against a >24-row seeded account
- [ ] 1.4 Body-only term returns the matching note
- [ ] 1.5 List payloads no longer include body columns

### Phase 2: Shared UI & lib ports

#### Automated

- [ ] 2.1 Type checking passes: `pnpm typecheck`
- [ ] 2.2 Linting passes: `pnpm lint`

#### Manual

- [ ] 2.3 Footer renders for 50 rows, hidden at <=24
- [ ] 2.4 Search box updates `?q=` without scroll jump

### Phase 3: Wire the list pages

#### Automated

- [ ] 3.1 Type checking passes: `pnpm typecheck`
- [ ] 3.2 Linting passes: `pnpm lint`
- [ ] 3.3 Build passes: `pnpm build`

#### Manual

- [ ] 3.4 Search + subject filter compose (AND)
- [ ] 3.5 Changing search/subject resets to page 1
- [ ] 3.6 Empty-state copy distinguishes no-items vs no-matches
- [ ] 3.7 Page links preserve `q` + `subjects`

### Phase 4: Subject sidebar client-side title filter

#### Automated

- [ ] 4.1 Type checking passes: `pnpm typecheck`
- [ ] 4.2 Linting passes: `pnpm lint`

#### Manual

- [ ] 4.3 Typing filters sidebar instantly, no navigation
- [ ] 4.4 Clearing restores list; active-note highlight intact

### Phase 5: Test layer

#### Automated

- [ ] 5.1 Unit tests pass: `pnpm test`
- [ ] 5.2 E2E pass: `pnpm test:e2e`
- [ ] 5.3 Type/lint/build pass

#### Manual

- [ ] 5.4 Full suite green before archive
