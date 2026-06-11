# Query / fetch performance audit

**Date:** 2026-06-07
**Status (updated 2026-06-11):** RESOLVED — nothing below is still open. **F1 applied** (`getSubjects()` now `select('id, title')` → `SubjectOptionT[]`). **F2 decided: leave** (marginal once F1 landed). F3–F5 stand as revisit-at-scale, no MVP action. The doc is kept as a finding record; do not re-propose its fixes.
**Scope:** every Supabase read across the app (all `queries.ts`, the actions that read, and the
route/component consumers that decide what gets fetched). Driven by the TODO:

> Stop over-fetching: select only needed columns (notes list pulls full objects/`content` but
> renders titles).

**Method:** read each query, traced it to its consumer(s), checked the selected columns against the
columns actually rendered/used, and cross-checked ordering/filtering against the DB indexes in
`supabase/migrations/`.

---

## Headline verdict: the TODO is already done

`getNotes` (`src/features/notes/queries.ts:31`) already selects only
`id, title, created_at, subjects(title)` — **never `content`** — and its return type
`NoteListItemT` (`src/features/notes/types.ts:5`) is a `Pick`. This was fixed on **2026-06-06** in
commit `8878f6d` ("feat(list-search-pagination): data layer — slim, paginate, search (p1)"), after
the TODO was written.

➡️ **Action: tick the TODO item off — no code change needed for the notes list.**

The same slimming was applied consistently to the other list reads:

| Query                     | Selects                                                                         | Renders                     | Verdict                                                                 |
| ------------------------- | ------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------- |
| `getNotes`                | `id, title, created_at, subjects(title)`                                        | title + topic chip + date   | ✅ lean                                                                 |
| `getMemoryCardsList`      | `id, prompt, note_id, due_at, state, subject_id, notes(title), subjects(title)` | same                        | ✅ lean (`stability` used only in WHERE, kept out of projection — good) |
| `getSubjectsList`         | `id, title, description, created_at`                                            | all four shown on list card | ✅ lean                                                                 |
| `getSubjectNoteSummaries` | `id, title, position`                                                           | sidebar nav                 | ✅ lean                                                                 |
| `getNotesForStats`        | `id, title`                                                                     | counts only                 | ✅ lean                                                                 |
| `getCardsForStats`        | `id, prompt, note_id, due_at, state, stability, lapses`                         | aggregation                 | ✅ lean                                                                 |
| review-events reads       | only the columns each tally needs                                               | aggregation                 | ✅ lean                                                                 |

---

## Findings (remaining, all low / informational)

### F1 — `getSubjects()` selects `*`, every consumer uses only `id` + `title` — LOW (real over-fetch)

`src/features/subjects/queries.ts:17` does `select('*')` and returns `SubjectT[]`. All six callers
consume only `id` and `title`:

- `notes/page.tsx:30` → `{ value: id, label: title }` filter options
- `memory-cards/page.tsx:54` → same
- `notes/components/note-form.tsx:61` → `<select>` options
- `memory-cards/components/card-form.tsx:66` → `<select>` options
- `notes/new/page.tsx:14` → `subjects.some(s => s.id === …)`
- `notes/[id]/page.tsx:39` → `subjects.find(s => s.id === …)` (and see F2)

So `description` + `created_at` are pulled for every subject and never read. Same class of bug as
the TODO, smaller magnitude (short text + a timestamp, vs note `content`).

**Fix — APPLIED 2026-06-11** (was the only concrete code change worth doing):

1. ✅ `SubjectOptionT = Pick<SubjectT, 'id' | 'title'>` exists in `src/features/subjects/types.ts`.
2. ✅ `getSubjects()` now `select('id, title')` → returns `SubjectOptionT[]` (`queries.ts:16`).
3. ✅ The form prop types consume `SubjectOptionT[]`.

No consumer read the dropped columns. Closed.

### F2 — `notes/[id]/page.tsx` read mode fetches ALL subjects to resolve ONE title — LOW

`notes/[id]/page.tsx:30-34` always fetches `getSubjects()` (whole list) in parallel, but in **read**
mode it uses it only to resolve `note.subject_id` → the subject's title for the eyebrow link
(`:39`). The full list is genuinely needed only in **edit** mode (the form picker). `edit` is known
before the fetch.

Marginal now F1 has landed (the payload is just `id`+`title` for all subjects). Options were: leave it
(simplest, parallel fetch is cheap at personal scale), or fetch a single subject in read mode.
**DECIDED 2026-06-11: leave** — revisit only if subject counts grow.

### F3 — text search does an un-indexed `ilike` over large columns — INFORMATIONAL (scale)

`getNotes` searches `or(title ilike, content ilike)` and `getMemoryCardsList` searches
`prompt/example/code_context`. `content` and the card answer columns are unindexed text, so each
search is a full-table `ILIKE` scan. Fine at personal scale (tens–hundreds of rows); the thing to
revisit first if data grows is a `pg_trgm` GIN index or a `tsvector` full-text column. No action now.

### F4 — review-events time-window reads have no `(user_id, reviewed_at)` index — INFORMATIONAL

`getReviewActivity` (400d), `getReviewsThisWeekCount` (8d), `getReviewedTodayCount` (2d) filter
`reviewed_at >= since` with only `review_events_user_id_idx` (user_id alone). Windows are explicitly
bounded, so the scan is tiny. A composite `(user_id, reviewed_at)` index would help only at much
larger history sizes. No action now.

### F5 — whole-table "fetch-all, aggregate in TS" stats reads — INFORMATIONAL (by design)

`getCardsForStats`, `getNotesForStats`, `getReviewActivity` deliberately fetch the full owned set and
bucket/count in TypeScript, because PostgREST can't `GROUP BY` an `APP_TIME_ZONE`-shifted date in a
plain select. Documented in-code and justified at personal scale. This is the first place to revisit
(move aggregation into a Postgres RPC / SQL view) if a user ever accumulates thousands of cards. No
action now.

---

## Verified clean (no change)

- **No N+1.** Embedded selects (`subjects(title)`, `notes(title)`) are single PostgREST joined
  queries, not per-row fetches.
- **Pagination is one round-trip** — `runPaginatedQuery` reads rows + `count: 'exact'` together; the
  second (count-only) query fires _only_ on a 416 out-of-range page.
- `getDueQueue` — `limit(1)` + `count: 'exact'` in one round-trip; backed by
  `memory_cards_user_id_due_at_idx`. ✅
- `isAccountEmpty` — `head: true` + `count: 'exact'` (no row payload), the cheapest existence probe. ✅
- Detail / edit / mutation reads that `select('*')` (`getNote`, `getMemoryCard`,
  `getMemoryCardForReview`, `getMemoryCardsForNote`, `rate-memory-card`) legitimately need the full
  row. ✅
- `getMemoryCardsList` ordering by `due_at` is index-backed; `getNotes` ordering by `created_at` is
  not composite-indexed but fine at scale (see F4-style note).

---

## Resolution (2026-06-11) — all closed

1. **F1 — DONE.** `getSubjects` slimmed to `select('id, title')` + `SubjectOptionT` shipped.
2. **Notes-list over-fetch — already satisfied** (`8878f6d`); the column-slimming half of S-11 is complete.
3. **F2–F5 — revisit at scale**, no change for the MVP (F2 decided: leave). No open code actions remain.
