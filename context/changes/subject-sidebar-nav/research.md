---
date: 2026-06-04T00:00:00Z
researcher: ex-Plant
git_commit: 452babcbbbba3ac2f66e0b77bcb11929a6048d7e
branch: main
repository: 10x_devs
topic: 'S-15 subject-sidebar-nav — codebase integration points for the docs-style single-pane subject view'
tags: [research, codebase, subjects, dnd-kit, render-markdown, layout-segment, reorder-note]
status: complete
last_updated: 2026-06-04
last_updated_by: ex-Plant
---

# Research: S-15 subject-sidebar-nav

**Date**: 2026-06-04
**Researcher**: ex-Plant
**Git Commit**: 452babcbbbba3ac2f66e0b77bcb11929a6048d7e
**Branch**: main
**Repository**: 10x_devs

## Research Question

Resolve the five open questions blocking `/10x-plan` for S-15 (a NEW docs-style `/subjects/[id]/read` view: persistent sidebar of a subject's notes, each row a `<Link>` that swaps the active note + drag-reorder via a dedicated handle; continuous `/subjects/[id]` view stays untouched for A/B):

1. Final route name (`read` / `browse` / `doc`).
2. How the sidebar dnd client island coexists with `<Link>` rows — the refactor of `ReorderableNoteList` (today listeners are on the whole `<li>`).
3. Empty / first-note redirect behavior.
4. A way to flip between continuous and single-pane views.
5. Whether the sidebar reads titles-only (it should — don't over-fetch `content`).

## Summary

The locked architecture (Next.js `layout.tsx` + nested `[noteId]` segment, soft RSC nav) is **forced, not stylistic**: `RenderMarkdown` is an `async` server-only Shiki component, so a client `?note=` swap is impossible — confirmed in both `render-markdown.tsx:21` and the already-documented constraint in `notes/[id]/page.tsx:16-21`. Every integration point S-15 needs already exists and is prop-/segment-ready:

- **Reorder:** the `reorderNote(noteId, position)` action and the client-side `midpoint()` helper are reused verbatim; only the island's markup changes (move `{...listeners}` from the `<li>` to a grip handle).
- **Light note body:** `RenderMarkdown` (prop `{ content }`) + `getNote(id)` are already reusable and already reused on the continuous subject page.
- **Active link:** mirror the S-10 app-nav `usePathname` + `isNavActive` pattern — but use an **exact** match for leaf note links, not the prefix matcher.

Two things must be **built new**: (a) a titles-only query `getSubjectNoteSummaries` (no existing query returns subject notes without `content`; model it on `getNotesForStats`), and (b) the repo's **first** `layout.tsx` + nested-segment pattern and **first** segment-level `loading.tsx`. One plan-time gotcha: `reorderNote`'s `revalidatePath('/subjects/[id]', 'page')` targets the OLD route — confirm it also reaches the new `/read` segment.

## Detailed Findings

### A. Reorder island + `reorderNote` (open question #2)

- **File to refactor:** `src/features/subjects/reorderable-note-list.tsx` (118 lines; `SortableRow` + `ReorderableNoteList`). Exported `ReorderableNoteT = { id; title; position }` (`:27`).
- **The refactor target — listeners on the whole row** (`reorderable-note-list.tsx:38-58`): `{...attributes} {...listeners}` are spread on the `<li>`, `cursor-grab` + `select-none` are row-wide, and the `⠿` glyph (`:54`) is a decorative `aria-hidden` span, **not** a wired handle. Rows are plain `<li>`+`<span>` — **no `<Link>`, no navigation today**.
- **Drop math** (`:73-94`): `arrayMove` then `midpoint(prevPos, nextPos, fallback)` (`:31-36`: both→`(p+n)/2`, top→`n/2`, bottom→`p+1`). Sends **only `(movedId, newPosition)`** — not the array, not the subject id.
- **Optimistic state:** `useState` (not `useOptimistic`), snapshot `previous`, eager `setItems(reordered)`, `if (!result.success) setItems(previous)` revert (`:88-93`). Renders `null` for `<2` notes (`:96`).
- **Action:** `src/features/subjects/actions/reorder-note.ts:19` — `reorderNote(noteId: string, position: number): Promise<ActionResultT>`. Re-validates `{ noteId: z.guid(), position: z.number() }` (`:9-12`), writes the single row verbatim (no server-side fraction recompute), `revalidatePath('/subjects/[id]', 'page')` (`:30`), no redirect. **`numeric` fractional position, NOT LexoRank** (`migrations/20260603151508_add_subjects_and_note_ordering.sql:50`); known unaddressed degeneracy (repeated midpoints exhaust float precision, no rebalance).
- **F1 RLS gate:** the `notes` UPDATE with-check also requires the note's subject to be owned by the caller — `reorderNote` cannot bypass it (`reorder-note.ts:16`).
- **Toast conformance:** uses the **imperative seam** `useActionTransition.run(() => reorderNote(...), { successMessage: 'Order saved' })` → `toastResult` (`components/toasts.ts:37`). NOT the `?toast=` redirect reader (correct — reorder stays on-page). Keep this wiring verbatim in the refactored island.

**Handle-split verdict:** mechanical, no structural obstacle. Keep `setNodeRef`+`attributes`+`transform`/`transition` on the `<li>` (the sortable node must stay the measured row); move **only `{...listeners}`** + `cursor-grab` onto a `<button>` wrapping a `GripVertical` (lucide-react installed). Drop/scope row-wide `select-none` so link text stays selectable. Spread `attributes` on the handle (or strip `role="button"`) so the row isn't both a button and a link. **No existing drag-handle precedent in the repo** — S-15 establishes it.

### B. Subject view + read helpers (open questions #4, #5)

- **Untouchable route:** `src/app/(protected)/subjects/[id]/page.tsx` — Server Component, `params: Promise<{id}>` + `searchParams: Promise<{edit?}>` (Next 16), `Promise.all([getSubject(id), getNotesForSubject(id)])` (`:29`), `notFound()` if missing. Renders `ReorderableNoteList` (titles-only ToC) above `notes.map` of `<section><h2><Link href="/notes/[id]"/></h2><RenderMarkdown content={note.content}/></section>` (`:81-90`), `width="prose"`. Carries the S-14 `?edit` branch. **S-15 leaves this file alone; it adds a sibling `/read` route.**
- **Read helpers** (`src/features/subjects/queries.ts`): `getSubjects` (`:13`, `*`), `getSubject` (`:22`, `*`, `maybeSingle`→`undefined`), `getNotesForSubject` (`:38`, **`*` — over-fetches `content`**), ordered `position asc nulls last, created_at asc` (`:48-49`). All RLS-scoped via server `createClient()` with an **injectable** `client?` for isolation E2E.
- **Titles-only (open #5 = YES):** no existing query returns `id,title,position` only. **Canonical lean precedent:** `getNotesForStats` (`src/features/notes/queries.ts:35-37`) — `.select('id, title, subject_id')` with a comment stating the intent ("avoids pulling note `content`"). Add `getSubjectNoteSummaries(subjectId, client?)` selecting `'id, title, position'` with `getNotesForSubject`'s exact ordering; return `Pick<NoteT,'id'|'title'|'position'>[]` (or a feature-local `NoteSummaryT`, mirroring `src/features/notes/types.ts`'s `NoteListItemT`).
- **Notes-list over-fetch (known follow-up):** `getNotes` (`notes/queries.ts:24`) selects `'*, subjects(title)'` — also pulls `content`. Follow `getNotesForStats`, not `getNotes`.
- **Content pane fetch:** reuse `getNote(id)` (`notes/queries.ts:44`, `*`, RLS, single-id, segment-ready).
- **Feature layout:** new sidebar-nav components → `src/features/subjects/components/`; new query → `src/features/subjects/queries.ts`. (Several subject components sit at the feature root — mixed convention already present.)

### C. Light note render + nested layout/segment (open questions #2-arch, #3)

- **`?edit` toggle is server-driven, no client edit state** (`notes/[id]/page.tsx:40` `isEditingNote = edit === 'note'`; read branch `<RenderMarkdown content={note.content}/>` `:77`; edit branch `<NoteForm .../>` `:68`). `?edit` is overloaded: `note` = body edit, `<checkId>` = topic-check edit.
- **WHY server-only forces layout+segment** (`render-markdown.tsx:9-21`): (1) it's an `async` component — async components only run server-side, can never mount in a client tree; (2) the `@shikijs/rehype` pipeline must be awaited (`MarkdownAsync`, not sync), with a measured ~3.3s/129MB first-render boot (curated `SHIKI_LANGS` + `lazy:true`). So a `'use client'` shell can't call `RenderMarkdown` → the only persistent-sidebar-while-body-changes option is a **server `layout.tsx` (sidebar) + nested `[noteId]` server segment** (RSC soft-nav streams only the child). Already documented at `notes/[id]/page.tsx:16-21`.
- **Read-only view is inlined in the page, not a standalone component** — but `RenderMarkdown` (prop `{content}`) is cleanly reusable and **already reused** on the subject page. The `[noteId]` segment needs `note.{id,title,content,updated_at,subject_id}` (all on `NoteT`, `src/types/note.ts:5`).
- **Layouts today (3):** root (`src/app/layout.tsx`), `(auth-pages)`, `(protected)`. **No parent-layout + child-segment / master-detail precedent exists** — S-15 is the first; lean on Next 16 docs (`node_modules/next/dist/docs/`).
- **Shell composition / double-wrap caveat:** `(protected)/layout.tsx:9-23` does the auth gate + `<AppNav/>` + `pt-14 md:pt-0`, but **does NOT apply `container-shell`** — width/padding is owned by `PageShell`'s `<main className="container-shell ...">` (`page-shell.tsx:61`). `PageShell` is a **client** component (`usePathname` + framer-motion) that takes server-rendered children. S-15's `/read` sub-layout must apply `container-shell` **once** and not stack a second `PageShell`/`container-shell` in the `[noteId]` segment. `container-shell` is a shared `@utility` in `globals.css` (max-w 120rem) — reuse, don't re-roll.
- **No `loading.tsx` anywhere** — S-15's content-pane streaming would be the repo's first segment-level `loading.tsx`/`<Suspense>` boundary.

### D. Active-link / soft-nav precedent

- **Matcher:** `src/components/app-nav/is-nav-active.ts:4-6` — `pathname === href || pathname.startsWith(\`${href}/\`)`. **No `useSelectedLayoutSegment` anywhere.\*\*
- **Template:** `NavLink` (`src/components/app-nav/nav-link.tsx:14-24`) — client, `usePathname` → toggles `variant` + `aria-current="page"`. Cleanest sidebar-link model.
- **Leaf-link nuance:** for `/subjects/[id]/read/[noteId]` use an **exact** `pathname === ...` match, not `isNavActive`'s prefix arm (which would over-match). `PageShell` already shows the exact-vs-prefix decision (`page-shell.tsx:56-58`).

## Code References

- `src/features/subjects/reorderable-note-list.tsx:38-58,73-94` — island to refactor (listeners on `<li>`; midpoint+optimistic)
- `src/features/subjects/actions/reorder-note.ts:19-32` — single-row fractional write, `ActionResultT`, `revalidatePath('/subjects/[id]','page')`
- `src/features/subjects/queries.ts:13-51` — `getSubjects`/`getSubject`/`getNotesForSubject` (all `*`)
- `src/features/notes/queries.ts:35-37` — `getNotesForStats` lean-select precedent for titles-only
- `src/features/notes/queries.ts:44-55` — `getNote(id)` for the content pane
- `src/app/(protected)/subjects/[id]/page.tsx:29-90` — untouchable continuous view
- `src/app/(protected)/notes/[id]/page.tsx:16-21,40,68,77` — `?edit` server-driven toggle + the server-only rationale
- `src/components/markdown/render-markdown.tsx:9-21` — async server-only Shiki renderer (architecture driver)
- `src/app/(protected)/layout.tsx:9-23` + `src/components/layout/page-shell.tsx:30-66` — shell, `container-shell`, double-wrap caveat
- `src/components/app-nav/is-nav-active.ts:4-6` + `nav-link.tsx:14-24` — active-link pattern
- `src/components/toasts.ts:37` + `src/hooks/use-action-transition.ts:28` — imperative toast seam reorder uses
- `e2e/subjects.spec.ts:70-86` — the drag E2E the handle-split will break
- `supabase/migrations/20260603151508_add_subjects_and_note_ordering.sql:50` — `position numeric`

## Architecture Insights

- **Server-only render is the load-bearing constraint** — it dictates the layout+segment design, the per-note `getNote` fetch in the segment, and why `?note=` was rejected. Honor it; don't try to lift the body into a client island.
- **Reorder is split client(midpoint)/server(write-verbatim)** — keep the math in the island; the action just trusts+writes. The handle-split touches only markup + the E2E drag target.
- **Two-tier select discipline:** lightweight lists select explicit columns (`getNotesForStats`), heavy views select `*`. The sidebar is a list → titles-only query.
- **Single `container-shell` / single `PageShell`** per page tree — avoid double-wrapping in the new sub-layout.

## Historical Context (from prior changes)

- `context/archive/2026-06-03-organize-notes-into-subjects/plan.md:46-130` — fractional `numeric` position chosen over LexoRank; `reorderNote(noteId,newPosition)` client-computed single-row write; `subject_id` nullable, no Inbox; subject-delete = **set null** (notes survive); assignment + reorder DB-gated by F1 RLS.
- `context/archive/2026-06-04-inline-edit-notes-and-subjects/{change.md:18,plan.md:9,14,31}` — `?edit` is searchParam-driven because `RenderMarkdown` is async server-only (the foundation S-15 stands on); PRG preserved by `redirect(bare path)` dropping `?edit` (form unmounts on success, no close logic); **no shared edit-toggle helper was built** (kept inline per consumer — don't hunt for one).
- `context/archive/2026-06-04-action-feedback-toasts/plan.md:114-237` — three toast seams; reorder uses the imperative `useActionTransition` seam (`'Order saved'`); the `?toast=` reader strips only the `toast` param (sibling params safe under nested segments).
- `context/foundation/lessons.md:91-96` — dnd-kit `useSortable` spreads `role="button"` onto the row → `getByRole('listitem')` finds 0; the handle-split fixes the cause, but E2E should still avoid `listitem` selection (use testid/text or the handle's `button`).
- `context/foundation/lessons.md:55-60` — measure perf in a prod build; the 10s figure that motivated this slice was a `next dev` mirage. S-15 is a UX experiment, not a perf fire.
- `context/foundation/lessons.md:77-82` — multi-editor `fillEditor` `.cm-content` ambiguity; scope to `.first()` if the single-pane ever mounts an editor beside topic-checks.

## Related Research

- `context/changes/subject-sidebar-nav/change.md` — the locked design this research backs.

## Open Questions (resolved → plan decisions)

1. **Route name** — still a `/10x-plan` decision (`read`/`browse`/`doc`). No codebase constraint; pick at plan time.
2. **dnd ↔ Link coexistence** — RESOLVED: move `{...listeners}`+`cursor-grab` to a `GripVertical` handle; keep `setNodeRef`/`attributes`/transform on the `<li>`; row body becomes the `<Link>`. Update the drag E2E to target the handle box.
3. **Empty / first-note redirect** — `/read/page.tsx` redirects to the first note by `position` order (reuse `getSubjectNoteSummaries`); if the subject has no notes, render an empty prompt instead of redirecting. (A redirect may carry `?toast=` safely — reader strips it.)
4. **Flip between views** — add a toggle link between `/subjects/[id]` (continuous) and `/subjects/[id]/read` (single-pane); both coexist. Exact placement = plan decision.
5. **Titles-only** — RESOLVED: YES. Add `getSubjectNoteSummaries` (`id,title,position`); the sidebar never pulls `content`; the `[noteId]` segment fetches one body via `getNote`.

**Plan-time gotcha to confirm:** `reorderNote`'s `revalidatePath('/subjects/[id]', 'page')` targets the old route — confirm/extend it to also revalidate the new `/read` layout/segment so the sidebar reflects a reorder.
