# Follow-ups — attach-topic-checks (S-02)

Deferred items from `/10x-impl-review` (see `reviews/impl-review.md`).

## F1 — Bound the per-note topic-check read (deferred)

- **Source**: impl-review F1 (WARNING, Performance).
- **Location**: `src/features/topic-checks/queries.ts` — `getTopicChecksForNote`.
- **Problem**: `select('*')` with no `.limit()`/pagination pulls full `code_context` blobs for every
  check on the note and Shiki-renders each server-side. Same class as the deferred **S-01 F1**
  (notes list pagination + `content` over-fetch, `context/archive/2026-06-03-capture-note-with-code/follow-ups/review-fixes.md`).
- **Why deferred**: personal-scale MVP — a note won't realistically carry hundreds of checks, so
  it isn't bounding anything today. Fold into the same pagination/over-fetch pass as S-01 F1
  rather than bounding one read in isolation.
- **Fix when picked up**: add `.range()`/`.limit()` and select only the columns the list needs
  (defer `code_context` until expanded, or cap), consistent with whatever S-01 F1 settles on.
- **Compounds with**: `topic-checks-section.tsx` runs server-side Shiki per `example`/`code_context`
  per check on every render, unmemoized — so the unbounded read scales the highlight cost linearly
  (≈2N Shiki passes for N checks). Acceptable at MVP scale; if check counts grow, memoize highlighted
  output keyed on `(check.id, updated_at)` or cache the highlighter. (`/simplify`, 2026-06-03.)
