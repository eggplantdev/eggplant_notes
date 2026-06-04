# Subject Sidebar Nav (Docs-Style Single-Pane Subject View) — Implementation Plan

## Overview

Build a **new, separate** docs-style subject view at `/subjects/[id]/read`: a persistent sidebar lists the subject's notes (titles only), clicking a row swaps the active note in a content pane that **server-renders the note's read-only markdown body**, and notes reorder by dragging a **dedicated grip handle** (not the whole row). The existing continuous "subject-as-document" view at `/subjects/[id]` stays in place for A/B comparison and gains exactly one additive flip link. This is an intentionally **temporary/experimental** view — if single-pane wins, replacing the continuous view is a future cleanup slice.

## Current State Analysis

(Grounded in `context/changes/subject-sidebar-nav/research.md`.)

- **Continuous view** — `src/app/(protected)/subjects/[id]/page.tsx`: Server Component, `Promise.all([getSubject, getNotesForSubject])`, `notFound()` if missing; renders `ReorderableNoteList` (titles-only ToC) above `notes.map` of `<section><h2><Link href="/notes/[id]"/></h2><RenderMarkdown content={note.content}/></section>`; carries the S-14 `?edit` branch.
- **Reorder island** — `src/features/subjects/reorderable-note-list.tsx`: `{...attributes} {...listeners}` spread on the whole `<li>` (`:38-58`); rows are plain `<li>`+`<span>`, **no Link, no navigation**; drop math is `arrayMove` + `midpoint(prev,next,fallback)` (`:31-36`); sends `(movedId, newPosition)` only; optimistic `useState` with `setItems(previous)` revert; renders `null` for `<2` notes.
- **Reorder action** — `src/features/subjects/actions/reorder-note.ts:19`: `reorderNote(noteId, position): Promise<ActionResultT>`, single-row verbatim write (no server fraction recompute), `revalidatePath('/subjects/[id]', 'page')` (**targets only the old route**), no redirect. F1 RLS with-check gates it. `numeric` fractional position (NOT LexoRank).
- **Read helpers** — `src/features/subjects/queries.ts`: `getSubject`/`getNotesForSubject` both `select('*')` → `getNotesForSubject` **over-fetches `content`**, ordered `position asc nulls last, created_at asc`; all RLS-scoped with an injectable `client?`. No titles-only query exists.
- **Lean-select precedent** — `getNotesForStats` (`src/features/notes/queries.ts:35-37`) selects `'id, title, subject_id'` with an explicit "avoids pulling `content`" comment. This is the model for the new titles-only query.
- **Light note render** — `notes/[id]/page.tsx` renders read-only via `<RenderMarkdown content={note.content}/>` (`:77`); `RenderMarkdown` (`src/components/markdown/render-markdown.tsx:21`) is an **async, server-only** Shiki component (prop `{ content }`) — cannot live in a client tree. `getNote(id)` (`notes/queries.ts:44`) is RLS-scoped, single-id, returns `undefined` if missing/not-owned.
- **Shell** — `(protected)/layout.tsx` does auth gate + `<AppNav/>` + `pt-14 md:pt-0`, **no `container-shell`**. `PageShell` (client; `usePathname` + framer-motion) owns `container-shell` (max-w 120rem) and the title/back/width header. **No existing `layout.tsx`+nested-segment precedent; no `loading.tsx` anywhere** — S-15 is the first of both.
- **Active-link pattern** — `src/components/app-nav/is-nav-active.ts` (`pathname === href || startsWith(href + '/')`) + `nav-link.tsx` (`usePathname` → variant + `aria-current`). No `useSelectedLayoutSegment` in repo.

## Desired End State

Navigating to `/subjects/[id]/read` shows a two-column docs layout: a sidebar listing the subject's notes by title (ordered by `position`), with the active note highlighted; the content pane server-renders that note's read-only body with full Shiki highlighting. Clicking another note is a soft RSC navigation — only the content pane streams (sidebar persists). Dragging a note's grip handle reorders it (the rest of the row is a navigation link); the new order persists and survives reload. On mobile (~360px) the sidebar collapses into a toggle-opened sheet, content full-width. The continuous view at `/subjects/[id]` is unchanged except for one "Switch to reading view" link; the single-pane view has the reverse link. An empty subject shows a prompt, not a crash.

**Verify:** load a seeded subject's `/read`, confirm sidebar order matches the continuous view; click between notes and confirm only the pane changes (sidebar scroll/focus preserved); drag a handle to reorder, reload, confirm order held; resize to 360px and confirm the sheet toggle works; flip both directions via the header links; visit `/read` for a subject with no notes.

### Key Discoveries:

- The layout+segment architecture is **forced** by `RenderMarkdown` being async/server-only (`render-markdown.tsx:21`, documented at `notes/[id]/page.tsx:16-21`) — a client `?note=` swap is impossible.
- Reorder reuses `reorderNote` + `midpoint` **verbatim**; only markup changes (listeners → handle). `midpoint` becomes a 2nd consumer → extract to a shared helper.
- `reorderNote`'s `revalidatePath('/subjects/[id]', 'page')` does **not** cover `/read` — must extend (`reorder-note.ts:30`).
- `getNotesForStats` (`notes/queries.ts:35`) is the exact titles-only select pattern to copy.
- dnd-kit `useSortable` spreads `role="button"` onto its node — the handle split is what fixes the `getByRole('listitem')` E2E trap (`lessons.md:91-96`); E2E should still avoid `listitem` selection.

## What We're NOT Doing

- **Not** touching the continuous view's render, data, or `ReorderableNoteList` — only adding one flip link to its header.
- **Not** rendering topic checks in the pane (body only).
- **Not** adding inline editing to `/read` — read-only; "Edit" links out to `/notes/[id]?edit=note`.
- **Not** building virtual scrolling (single body, not 52 — assess-only per `change.md`).
- **No** schema change, **no** new server action, **no** new migration.
- **Not** removing the continuous view (future A/B-resolution slice).
- **Not** changing `reorderNote`'s contract — only its `revalidatePath` coverage.

## Implementation Approach

Three incremental phases, each independently verifiable. Phase 1 makes the read-only view render by URL (no nav, no reorder). Phase 2 makes it navigable and reorderable via the sidebar island. Phase 3 makes it discoverable via the flip links. New code lives in `src/features/subjects/components/` and a new `src/app/(protected)/subjects/[id]/read/` route tree. The sidebar is a **new** client island (not a refactor of the locked `ReorderableNoteList`) to keep the continuous view's behavior frozen; shared `midpoint` is extracted since it now has two consumers.

## Critical Implementation Details

- **Single `container-shell` / single `PageShell`.** `(protected)/layout.tsx` provides no width container. The `read/layout.tsx` applies the shell **once** (sidebar + content slot); the `[noteId]` segment renders bare content (its own `PageShell` would double-wrap header/motion/container). Decide at implement-time whether the per-note title/back header lives in the layout (stable) or the segment.
- **Reorder revalidation must reach `/read`.** After the handle-drag writes a new `position`, the sidebar (rendered in `read/layout.tsx`) must reflect it. `reorderNote` currently revalidates only `/subjects/[id]`. Extend it to also revalidate the layout segment that renders the sidebar (`revalidatePath('/subjects/[id]/read', 'layout')`) so both the optimistic island and a hard reload agree.
- **Handle split, not row listeners.** Keep `setNodeRef` + `attributes` + `transform`/`transition` on the `<li>` (the sortable node must stay the measured row for `verticalListSortingStrategy`); spread **only `{...listeners}`** + `cursor-grab` on the `GripVertical` handle. Drop row-wide `select-none`. This is also the fix for the `role="button"` listitem E2E trap.
- **Active-link = exact match.** Sidebar note links are leaves — use `pathname === \`/subjects/${id}/read/${noteId}\``, NOT `isNavActive`'s prefix arm (which over-matches).

## Phase 1: Data + Route Skeleton

### Overview

Add a titles-only query and scaffold the route tree so `/subjects/[id]/read/[noteId]` renders a note's read-only body inside a persistent (static for now) shell, with an index redirect and a streaming fallback.

### Changes Required:

#### 1. Titles-only subject-notes query

**File**: `src/features/subjects/queries.ts`

**Intent**: Provide a lightweight list of a subject's notes for the sidebar without dragging every note's `content` over the wire.

**Contract**: New `getSubjectNoteSummaries(subjectId: string, client?: SupabaseClient<Database>)` returning `Pick<NoteT, 'id' | 'title' | 'position'>[]`. Selects `'id, title, position'`, `.eq('subject_id', subjectId)`, with the SAME ordering as `getNotesForSubject` (`order('position', { ascending: true, nullsFirst: false })` then `order('created_at', { ascending: true })`). RLS-scoped via the default server client; injectable for isolation E2E. Mirrors `getNotesForStats`.

#### 2. Read-view layout (persistent shell + sidebar slot)

**File**: `src/app/(protected)/subjects/[id]/read/layout.tsx`

**Intent**: Server Component that fetches the subject + note summaries once and renders the docs shell — `PageShell` (applying `container-shell` once) wrapping a two-column layout: sidebar slot on the left, `{children}` (the active-note segment) on the right. Persists across note clicks so only the child segment re-renders.

**Contract**: `async function ReadLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> })`. Awaits `params`; `Promise.all([getSubject(id), getSubjectNoteSummaries(id)])`; `notFound()` if subject missing. Renders the sidebar (Phase 1: a static server-rendered titles list of `<Link href={`/subjects/${id}/read/${note.id}`}>`; Phase 2 swaps in the client dnd island). Two-column responsive grid; sidebar hidden behind a toggle on mobile is Phase 2.

#### 3. Read-view index (first-note redirect / empty prompt)

**File**: `src/app/(protected)/subjects/[id]/read/page.tsx`

**Intent**: Entry point for `/subjects/[id]/read` with no note selected — send the user to the first note, or show an empty prompt.

**Contract**: `async function ReadIndex({ params })`. Awaits `params`; fetches summaries (or reuses the layout's via its own call); if ≥1 note → `redirect(`/subjects/${id}/read/${first.id}`)` (first by `position` order); if 0 notes → render an empty-state prompt ("This subject has no notes yet" + link to create/assign). No `notFound()` here (subject existence is the layout's job).

#### 4. Active-note segment (read-only body)

**File**: `src/app/(protected)/subjects/[id]/read/[noteId]/page.tsx`

**Intent**: Server-render the selected note's read-only markdown body in the content pane.

**Contract**: `async function ReadNote({ params })`. Awaits `params: Promise<{ id: string; noteId: string }>`; `getNote(noteId)`; if missing/not-owned → `notFound()`. Renders the note title + an "Edit" link to `/notes/${noteId}?edit=note` + `<RenderMarkdown content={note.content} />`. Renders **bare content** (no nested `PageShell` — layout owns the shell). Optionally guard that `note.subject_id === id` (belongs to this subject) → `notFound()` otherwise.

#### 5. Segment streaming fallback

**File**: `src/app/(protected)/subjects/[id]/read/[noteId]/loading.tsx`

**Intent**: The repo's first segment-level loading boundary — show a content-pane skeleton while the heavy Shiki render streams, so the sidebar stays interactive.

**Contract**: Default-export a simple skeleton matching the prose content area. Pure presentational.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Production build passes: `pnpm build`

#### Manual Verification:

- `/subjects/[id]/read` redirects to the first note; `/subjects/[id]/read/[noteId]` renders that note's body with code highlighting.
- Sidebar lists all the subject's notes in `position` order (matches the continuous view).
- A subject with no notes shows the empty prompt, not a crash.
- An invalid/foreign `noteId` 404s.
- Verified against a **production build** (`next start`), not `next dev` (per `lessons.md` perf rule).

**Implementation Note**: After Phase 1 automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Sidebar DnD Island (Handle Split + Nav + Mobile)

### Overview

Replace the static sidebar list with a client island whose rows are navigation `<Link>`s AND drag-reorderable via a dedicated grip handle, with active-note highlighting and a mobile sheet. Reuse `reorderNote` + the extracted `midpoint`; extend reorder revalidation to cover `/read`.

### Changes Required:

#### 1. Extract shared `midpoint` helper

**File**: `src/features/subjects/midpoint.ts` (new) — or co-located shared util in the subjects feature.

**Intent**: `midpoint` now has two consumers (`ReorderableNoteList` + the new sidebar) → promote it out of the component per the 2nd-consumer rule.

**Contract**: Export `midpoint(prev: number | undefined, next: number | undefined, fallback: number): number` with the existing semantics (both → `(prev+next)/2`; top → `next/2`; bottom → `prev+1`; neither → `fallback`). Update `reorderable-note-list.tsx` to import it (this is the ONLY change to that locked file — a pure no-behavior-change extraction). Add a unit test for `midpoint`.

#### 2. Sidebar dnd island

**File**: `src/features/subjects/components/subject-note-sidebar.tsx` (new, `'use client'`)

**Intent**: The docs sidebar — a sortable list where each row navigates (Link) and reorders (handle).

**Contract**: Props `{ subjectId: string; notes: Pick<NoteT,'id'|'title'|'position'>[] }`. Each row: `<li>` is the `useSortable` node (`setNodeRef` + `attributes` + transform); a `GripVertical` `<button>` carries `{...listeners}` + `cursor-grab`; the rest of the row is `<Link href={`/subjects/${subjectId}/read/${note.id}`}>`. Active highlight via `usePathname()` exact match (`pathname === `/subjects/${subjectId}/read/${note.id}``) → variant + `aria-current="page"`. On drop: `arrayMove`→`midpoint`→ optimistic`setItems`→`useActionTransition.run(() => reorderNote(id, position), { successMessage: 'Order saved' })`→ revert on`!result.success`. Reuses `DndContext`/`SortableContext`/`verticalListSortingStrategy`. Does NOT render `null`for`<2` notes (the sidebar must always list notes for navigation even when reorder is a no-op — guard the DnD wrapper, not the list).

#### 3. Mobile sheet wrapper

**File**: same island or a sibling `subject-note-sidebar.tsx` composition using the existing shadcn `Sheet`.

**Intent**: At ~360px, hide the sidebar behind a toggle that opens a Sheet; content pane full-width. Mirror the S-10 mobile hamburger+sheet pattern.

**Contract**: Desktop (`md+`): sidebar always visible as a column. Mobile: a trigger button opens `<Sheet>` containing the same sortable list. Reuse `components/ui/sheet`. Local open/close state in the island.

#### 4. Wire the island into the layout

**File**: `src/app/(protected)/subjects/[id]/read/layout.tsx`

**Intent**: Swap the Phase-1 static list for `<SubjectNoteSidebar subjectId={id} notes={summaries} />`.

**Contract**: Pass the server-fetched summaries as props (island stays titles-only). No other layout change.

#### 5. Extend reorder revalidation

**File**: `src/features/subjects/actions/reorder-note.ts`

**Intent**: A reorder triggered from `/read` must refresh the sidebar there, not only the continuous route.

**Contract**: Add `revalidatePath('/subjects/[id]/read', 'layout')` alongside the existing `revalidatePath('/subjects/[id]', 'page')`. No signature/return change. (Both routes stay correct.)

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- `midpoint` unit test passes: `pnpm test`
- Production build passes: `pnpm build`

#### Manual Verification:

- Clicking a sidebar row navigates (soft) and highlights it; dragging the grip handle reorders without triggering navigation; clicking the row body never starts a drag.
- Reorder persists across a hard reload (revalidation reaches `/read`).
- A failed reorder reverts the optimistic order AND shows an error toast (kill the local Supabase or force failure to verify).
- At 360px the sidebar collapses to a sheet; opening it shows the list; navigation closes/keeps it sensibly.
- Continuous view `/subjects/[id]` reorder still works unchanged.

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: View-Flip Toggles

### Overview

Make the two views reachable from each other with one additive link each (the agreed relaxation of the `change.md` "untouched" lock).

### Changes Required:

#### 1. Flip link on the continuous view

**File**: `src/app/(protected)/subjects/[id]/page.tsx`

**Intent**: Add a single "Switch to reading view" link in the continuous view's header. This is the ONLY change to this file (lock relaxation recorded in the brief).

**Contract**: A `<Link href={`/subjects/${id}/read`}>` placed in the `PageShell` header actions (or near the title). No other markup, data, or behavior change.

#### 2. Reverse flip link on the read view

**File**: `src/app/(protected)/subjects/[id]/read/layout.tsx`

**Intent**: Symmetric "Switch to continuous view" link.

**Contract**: A `<Link href={`/subjects/${id}`}>` in the read-view header.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Production build passes: `pnpm build`

#### Manual Verification:

- From `/subjects/[id]` the link opens `/subjects/[id]/read` (lands on first note); from `/read` the reverse link returns to the continuous view.
- The continuous view is otherwise visually/behaviorally identical to before.

---

## Testing Strategy

> Per the project review gate (CLAUDE.md), E2E/unit specs are authored AFTER `/10x-impl-review` + `/simplify`, against the cleaned-up code — not during the implementation phases above. This section is the spec contract for that step.

### Unit Tests:

- `midpoint(prev, next, fallback)` — both neighbors, top (prev undefined), bottom (next undefined), neither (fallback), and equal-neighbor degeneracy. (`src/__tests__/`.)

### Integration / E2E Tests (`e2e/`):

- **Renders read view**: seed a subject with ≥2 notes, visit `/subjects/[id]/read` → asserts redirect to first note + body highlighted (`pre.shiki span[style*="--shiki"]` per `lessons.md:70-75`).
- **Sidebar navigation**: click a second note's row → URL changes to its `[noteId]`, pane body changes, active highlight moves. Select rows by `data-testid`/text, NOT `getByRole('listitem')` (`lessons.md:91-96`).
- **Handle reorder**: drag the **handle's** bounding box (not the row body) to reorder; reload; assert new order. Clicking the row body navigates (does not drag).
- **Empty subject**: subject with 0 notes → empty prompt, no crash.
- **Mobile sheet**: at 360px viewport, sidebar trigger opens the sheet list.
- Follow the fresh-per-test sign-up + `uniqueEmail` convention; `retries: 2` covers GoTrue flake (`lessons.md:34-39`).

### Manual Testing Steps:

1. Production build (`next start`), load a seeded subject's `/read`; click through several notes — confirm only the pane streams.
2. Drag a handle to reorder; reload; confirm persistence.
3. Resize to 360px; toggle the sidebar sheet.
4. Flip both directions via the header links.
5. Confirm the continuous view is unchanged.

## Performance Considerations

The single-pane pane renders ~1 note body per navigation (vs the continuous view's N bodies), so Shiki cost per view is much lower; the `loading.tsx` boundary streams the pane so the sidebar is immediately interactive. The sidebar query is titles-only (no `content`). Virtual scrolling is deferred (assess-only) — a single body doesn't justify it. Validate latency on a prod build, never `next dev` (`lessons.md:55-60`).

## Migration Notes

None — no schema change, no data migration. `reorderNote`'s extra `revalidatePath` is additive and backward-compatible with the continuous view.

## References

- Research: `context/changes/subject-sidebar-nav/research.md`
- Design: `context/changes/subject-sidebar-nav/change.md`
- Reorder island to mirror (handle split target): `src/features/subjects/reorderable-note-list.tsx:31-94`
- Reorder action: `src/features/subjects/actions/reorder-note.ts:19-32`
- Lean-select precedent: `src/features/notes/queries.ts:35-37`
- Light render + server-only constraint: `src/components/markdown/render-markdown.tsx:21`, `src/app/(protected)/notes/[id]/page.tsx:16-21`
- Active-link pattern: `src/components/app-nav/is-nav-active.ts`, `nav-link.tsx`
- Toast seam: `src/hooks/use-action-transition.ts`, `src/components/toasts.ts:37`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data + Route Skeleton

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck`
- [x] 1.2 Linting passes: `pnpm lint`
- [x] 1.3 Production build passes: `pnpm build`

#### Manual

- [x] 1.4 `/read` redirects to first note; `[noteId]` renders body with highlighting
- [x] 1.5 Sidebar lists notes in `position` order matching continuous view
- [x] 1.6 Empty subject shows prompt, not crash
- [x] 1.7 Invalid/foreign `noteId` 404s
- [x] 1.8 Verified on a production build, not `next dev`

### Phase 2: Sidebar DnD Island (Handle Split + Nav + Mobile)

#### Automated

- [ ] 2.1 Type checking passes: `pnpm typecheck`
- [ ] 2.2 Linting passes: `pnpm lint`
- [ ] 2.3 `midpoint` unit test passes: `pnpm test`
- [ ] 2.4 Production build passes: `pnpm build`

#### Manual

- [ ] 2.5 Row click navigates + highlights; handle drag reorders; row-body click never drags
- [ ] 2.6 Reorder persists across hard reload (revalidation reaches `/read`)
- [ ] 2.7 Failed reorder reverts optimistic order AND shows error toast
- [ ] 2.8 At 360px sidebar collapses to a sheet and lists notes
- [ ] 2.9 Continuous view reorder still works unchanged

### Phase 3: View-Flip Toggles

#### Automated

- [ ] 3.1 Type checking passes: `pnpm typecheck`
- [ ] 3.2 Linting passes: `pnpm lint`
- [ ] 3.3 Production build passes: `pnpm build`

#### Manual

- [ ] 3.4 Continuous→read and read→continuous links both work
- [ ] 3.5 Continuous view otherwise identical to before
