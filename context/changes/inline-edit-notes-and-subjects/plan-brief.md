# Inline-edit for Notes and Subjects — Plan Brief

> Full plan: `context/changes/inline-edit-notes-and-subjects/plan.md`
> Research: `context/changes/inline-edit-notes-and-subjects/research.md`

## What & Why

Editing is split incoherently today: the subject picker and topic checks edit **in place** on `/notes/[id]`, but the note **body** is exiled to `/notes/[id]/edit`, and subjects have the same split. This slice collapses view+edit into one page for both — light read-only by default, a `?edit` searchParam toggles the form in place — and deletes the two `/edit` routes. It is the foundation for S-15 (docs-style single-pane subject view), whose click-to-open only works once the read view is the cheap default.

## Starting Point

The exact pattern already ships once: topic-checks inline edit via `?edit=<checkId>` on `/notes/[id]`, fully server-driven (no client `isEditing` state — forced by `RenderMarkdown` being async/server-only). `NoteForm` and `SubjectForm` are already union-typed create/edit forms; the `/edit` routes are ~20-line wrappers around them. The update actions already redirect-on-success to the bare detail path.

## Desired End State

`/notes/[id]?edit=note` shows the body+subject in `NoteForm` (topic checks still listed read-only below); `/subjects/[id]?edit` shows title/description in `SubjectForm`. Saving redirects to the bare path (form unmounts, fresh content). Both `/edit` routes are gone (404). The default detail render stays light — no CodeMirror/form, no extra client JS.

## Key Decisions Made

| Decision                  | Choice                                                                                                 | Why (1 sentence)                                                                                                                                                       | Source                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Edit-mode mechanism       | URL `?edit` searchParam, server-driven                                                                 | `RenderMarkdown` is async/server-only — a client toggle can't swap it.                                                                                                 | Research                                 |
| Shared edit-toggle helper | None — keep inline per feature                                                                         | The mechanism is ~3-5 lines; below the abstraction bar; real shared seams already promoted.                                                                            | Research (overrides change.md "promote") |
| Header in edit mode       | Pass an "Edit note"/"Edit subject" label to PageShell's required `<h1>`; form holds the editable title | PageShell `title` is required + always-rendered — can't be suppressed; the label avoids a duplicate title with no PageShell change (mirrors the deleted /edit routes). | Plan-review (F1)                         |
| Success feedback          | Ship redirects bare; add `?toast=` when S-16 lands                                                     | S-16's `?toast=` reader is mid-flight and strips only its own param (safe beside `?edit`).                                                                             | Research                                 |
| Edit entry                | Keep explicit "Edit" button → `<Link href="?edit">`                                                    | Zero new UX, mirrors the topic-check Edit link, lowest risk.                                                                                                           | Plan                                     |
| Edit layout (notes)       | Form replaces body+subject; checks stay read-only below                                                | Reference your checks while editing; matches existing coexistence.                                                                                                     | Plan                                     |
| Unsaved edits             | Discard silently on Cancel/navigate                                                                    | Matches today's `/edit` route; no new dirty-tracking.                                                                                                                  | Plan                                     |
| Test coverage             | Extend E2E + assert old routes 404                                                                     | The route deletion is the real regression risk; must be verified.                                                                                                      | Plan                                     |

## Scope

**In scope:** `?edit=note` body+subject form on `/notes/[id]`; `?edit` title/description form on `/subjects/[id]`; delete both `/edit` routes; convert Edit buttons to `?edit` links + Cancel links; extend E2E.

**Out of scope:** any shared helper / new tier; `PageShell` changes; topic-check edit changes; unsaved-changes guard; `?toast=` wiring; Shiki/langs (S-13); the docs-style subject view (S-15).

## Architecture / Approach

Generalize one proven in-repo idiom (`topic-checks-section.tsx`): server page reads `await searchParams`, branches read-view vs the existing form, enter via `<Link href="?edit">`, exit via `<Link>` to the bare path. Update actions are untouched — their `revalidate ×2 + redirect(bare path)` already implements PRG, and the redirect dropping `?edit` is what unmounts the form on success. Two independent phases (notes, then subjects); no shared code between them.

## Phases at a Glance

| Phase                     | What it delivers                                                                 | Key risk                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Notes in-place edit    | `?edit=note` body+subject form on `/notes/[id]`; delete `/notes/[id]/edit`       | `?edit` dual meaning (`note` vs `<checkId>`) — must NOT pass `'note'` as `editId` to the checks section or its stale guard misfires                         |
| 2. Subjects in-place edit | `?edit` title/description form on `/subjects/[id]`; delete `/subjects/[id]/edit` | Header: edit mode passes an "Edit subject" label to PageShell's required `<h1>` (mirrors the deleted route) — avoids a duplicate title, no PageShell change |

**Prerequisites:** S-01, S-02, S-06 (all done). Coordinate file-touch with in-flight S-13 (only `render-markdown.tsx`, not touched here) and S-16 (toasts).
**Estimated effort:** ~1 session across 2 phases; small, mechanical, no schema.

## Open Risks & Assumptions

- **`?edit` dual-meaning routing on the note page** is the one non-obvious detail — covered in Critical Implementation Details; the E2E must exercise both a body edit and a check edit to lock it.
- Assumes `getSubjects()` is acceptable to fetch on the note detail page in edit mode (it is — the `/edit` route already did).
- Assumes the two `/edit` routes have no inbound links other than the detail-page Edit buttons (grep-verify during implement).

## Success Criteria (Summary)

- Note and subject detail pages edit in place via `?edit`; saving updates content and returns to the bare path; Cancel discards.
- Both `/edit` routes 404; default detail render stays light (production build).
- `pnpm typecheck`/`lint`/`build` green; extended E2E green incl. the route-removal assertions.
