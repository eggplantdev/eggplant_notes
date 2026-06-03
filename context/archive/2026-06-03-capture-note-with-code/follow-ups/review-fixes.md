# Review Follow-ups — capture-note-with-code (S-01)

Deferred / open items from the 2026-06-03 implementation review (`../reviews/impl-review.md`).

## Deferred

### F1 — Paginate the notes list (and stop over-fetching `content`)

- **Source**: impl-review F1 (WARNING, Performance). `src/features/notes/queries.ts:14`.
- **Now**: `getNotes()` does `select('*').order('created_at')` — no `.limit()`, and pulls every note's full markdown `content` to render a list that only shows title + created_at.
- **Decision (2026-06-03)**: DEFER. Pagination is planned for a later stage; fold the fix in there rather than ship a stopgap `.limit()` now.
- **When done**: switch the list query to `.select('id, title, created_at')` + `.range()` pagination, and give the list its own narrow row type (not `NoteT`). Inherited from F-02, so the change touches `queries.ts` (an F-02 file).
