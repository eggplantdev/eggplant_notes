# Subject Sidebar Nav (Docs-Style Single-Pane Subject View) — Plan Brief

> Full plan: `context/changes/subject-sidebar-nav/plan.md`
> Research: `context/changes/subject-sidebar-nav/research.md`

## What & Why

Build a **new, separate** docs-style subject view at `/subjects/[id]/read` — a persistent sidebar of the subject's notes, click to swap the active note in a content pane, drag a dedicated handle to reorder — to A/B against the existing continuous "subject-as-document" view. UX-led experiment ("test how it feels"), not a perf fire (the 10s figure that first motivated it was a `next dev` mirage).

## Starting Point

The continuous view (`/subjects/[id]`) renders all note bodies stacked, with a titles-only ToC (`ReorderableNoteList`) whose dnd listeners sit on the whole row (no navigation). `RenderMarkdown` is async/server-only; `reorderNote` does a single-row fractional write but revalidates only the old route. No titles-only query, no `layout.tsx`+segment pattern, and no `loading.tsx` exist yet.

## Desired End State

`/subjects/[id]/read` shows a two-column docs layout: a titles-only sidebar (active note highlighted) + a content pane that server-renders one note's read-only body. Clicking a note is a soft RSC navigation (only the pane streams). Dragging a note's grip handle reorders it; the row body is a navigation link. On mobile the sidebar collapses to a sheet. Both views are reachable from each other via one flip link each. The continuous view is otherwise unchanged.

## Key Decisions Made

| Decision           | Choice                                                        | Why (1 sentence)                                                               | Source   |
| ------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| Architecture       | Server `layout.tsx` (sidebar) + nested `[noteId]` segment     | `RenderMarkdown` is async/server-only, so a client `?note=` swap is impossible | Research |
| Content pane scope | Body only (no topic checks)                                   | Truest docs-reading experience; matches the scope guard                        | Plan     |
| Edit affordance    | Read-only; "Edit" links out to `/notes/[id]?edit=note`        | Keeps the pane light; avoids CodeMirror island + multi-editor E2E trap         | Plan     |
| Route name         | `/subjects/[id]/read`                                         | Reading-focused, short, trivially deletable when the A/B resolves              | Plan     |
| View flip          | One link on each header (relaxes the "untouched" lock)        | Symmetric A/B flipping from either side                                        | Plan     |
| Mobile             | Collapsible sheet (mirror S-10)                               | Usable at 360px, consistent with app nav                                       | Plan     |
| Reorder            | Reuse `reorderNote` + extract shared `midpoint`; handle split | No new action; `midpoint` is now a 2nd consumer → promote                      | Research |
| Sidebar query      | New titles-only `getSubjectNoteSummaries`                     | Don't over-fetch `content` for nav; model on `getNotesForStats`                | Research |

## Scope

**In scope:** new `/read` route tree (layout + index redirect + `[noteId]` segment + `loading.tsx`); titles-only query; new sidebar dnd island with handle split + mobile sheet; `reorderNote` revalidation extended to `/read`; shared `midpoint` extraction; two flip links.

**Out of scope:** topic checks in the pane; inline editing in `/read`; virtual scrolling; any schema/action/migration change; removing the continuous view; refactoring the locked `ReorderableNoteList` (beyond the no-behavior `midpoint` import swap).

## Architecture / Approach

`read/layout.tsx` (server) fetches the subject + note summaries once and renders `PageShell` + the client sidebar island + `{children}`. The nested `read/[noteId]/page.tsx` (server) fetches one note via `getNote` and renders `RenderMarkdown` (bare — layout owns the shell). Soft RSC navigation streams only the segment. The sidebar island keeps `useSortable` on the `<li>` but moves drag listeners to a `GripVertical` handle, leaving the row as a `<Link>`; reorder reuses `reorderNote` + `useActionTransition` (optimistic revert + 'Order saved' toast).

## Phases at a Glance

| Phase                    | What it delivers                                                                               | Key risk                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1. Data + route skeleton | Read-only single-pane renders by URL (query, layout, index redirect, segment, loading)         | First layout+segment + first `loading.tsx` in repo; single-shell/no-double-wrap discipline      |
| 2. Sidebar dnd island    | Navigable + reorderable sidebar (handle split, active highlight, mobile sheet, revalidate fix) | Click-vs-drag separation; reorder revalidation reaching `/read`; not regressing continuous view |
| 3. View-flip toggles     | Discoverable + A/B flippable via one link each                                                 | Touching the continuous page (lock relaxation — recorded)                                       |

**Prerequisites:** S-14 (inline-edit, shipped — light read-only note render) + S-06 (subjects + ordering, shipped). Local Supabase stack up for manual/E2E.
**Estimated effort:** ~2-3 sessions across 3 phases.

## Open Risks & Assumptions

- **Lock relaxation:** the continuous view is no longer byte-for-byte "untouched" — it gains one flip link (operator-approved).
- **Fractional `position` degeneracy** is pre-existing (repeated midpoints exhaust float precision; no rebalance) — not addressed here, same as the continuous view.
- **Revalidation path string** `'/subjects/[id]/read'` must match Next's route literal for the layout revalidate to fire — verify at implement time.

## Success Criteria (Summary)

- A user can read a subject note-by-note in a persistent-sidebar layout, switching notes with only the content pane updating.
- A user can reorder notes by dragging a handle (row click navigates, never drags), and the order persists.
- Both views are reachable from each other; the continuous view is otherwise unchanged; the view works at 360px.
