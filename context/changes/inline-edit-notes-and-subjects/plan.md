# Inline-edit for Notes and Subjects Implementation Plan

## Overview

Collapse view + edit into one page for notes and subjects. Today editing the note **body** and the subject **header** lives on separate `/notes/[id]/edit` and `/subjects/[id]/edit` routes, while the subject picker and topic checks already edit in place on the detail page. This plan generalizes the existing server-driven `?edit=<checkId>` topic-check pattern to the note body (`?edit=note`) and the subject header (`?edit`), reuses the existing `NoteForm`/`SubjectForm`, preserves the PRG redirect-on-success verbatim, and deletes the two now-redundant `/edit` routes.

## Current State Analysis

The codebase already implements the exact target pattern once — topic-checks inline edit via `?edit=<checkId>` on `/notes/[id]` — and it is fully server-driven (no client `isEditing` state). That is _forced_ by `RenderMarkdown` being an async, server-only Shiki component (`src/components/markdown/render-markdown.tsx:9-14,21`) that cannot live behind a client toggle.

- **Note detail page** (`src/app/(protected)/notes/[id]/page.tsx:17-25`): already reads `searchParams: Promise<{ edit?: string }>`, passes `editId={edit}` to `TopicChecksSection` (`:55`), and renders the body unconditionally (`:53`). The "Edit" button (`:44-46`) currently `<Link>`s to the separate `/notes/[id]/edit` route.
- **Topic-check idiom to mirror** (`src/features/topic-checks/topic-checks-section.tsx`): find row (`:22`), stale-param guard `if (editId && !editingCheck) redirect(bare)` (`:25`), enter-edit `<Link href="?edit=...">` (`:43`), `key`-remount of the client form (`:59`). Cancel is a `<Link>` to the bare path (`topic-check-form.tsx:109-111`).
- **Reusable forms already edit-capable** (union-typed): `NoteForm` (`src/features/notes/note-form.tsx:36-47,82-92`) and `SubjectForm` (`src/features/subjects/subject-form.tsx:18-33`). The `/edit` routes are ~20-line wrappers (`notes/[id]/edit/page.tsx:12-22`, `subjects/[id]/edit/page.tsx:10-24`) that fetch + render these forms.
- **PRG preserved verbatim**: `updateNote` (`src/features/notes/actions/update-note.ts:44-48`) and `updateSubject` (`src/features/subjects/actions/update-subject.ts:27-29`) both do `revalidatePath(list) + revalidatePath(detail) + redirect(bare detail path)`. The redirect _throws_ (`NEXT_REDIRECT`), so the form's `onSubmit` only ever sees the failure branch; success is proven by navigation. Redirecting to the bare path drops `?edit` → the form unmounts on success with no extra "close" logic.
- **Subject detail page** (`src/app/(protected)/subjects/[id]/page.tsx:16-38`): does **not** read searchParams today, renders the header via `PageShell title/subtitle` (`:22-24`). `ReorderableNoteList` is a client drag component that does not read searchParams → no `?edit` conflict.
- **No `loading.tsx`/`error.tsx` anywhere in `src/app`**; the only `<Suspense>` is the sign-in `DeletedNotice`. A server-prop `?edit` (the section pattern) needs no Suspense.

### Key Discoveries:

- `RenderMarkdown` is server-only and async → edit mode MUST be URL-driven, not a client `useState` toggle (`render-markdown.tsx:9-14`).
- The note page's `?edit` param will carry **two meanings**: `note` (body form) and `<checkId>` (a topic check). One param, mutually exclusive branches; the server inspects the value.
- Ids validate with `z.guid()` (shape only), not `z.uuid()` — already correct in `noteIdSchema`/`subjectIdSchema` (`notes/schemas.ts:30`, `subjects/schemas.ts:26`); no change needed.
- `S-16 action-feedback-toasts` (in progress, P1 landed) is generalizing `?deleted=1`→`?toast=<key>`; its reader strips only the `toast` param (safe beside `?edit`). This slice ships redirects **bare** and gains `?toast=` when S-16 lands — no throwaway notice.

## Desired End State

`/notes/[id]?edit=note` shows the note body+subject in the `NoteForm` (topic checks still listed read-only below); saving redirects to `/notes/[id]` (form gone, fresh content). `/subjects/[id]?edit` shows the title/description in the `SubjectForm`; saving redirects to `/subjects/[id]`. The bare detail pages render light read-only (no CodeMirror/form in the default render). Both `/notes/[id]/edit` and `/subjects/[id]/edit` routes are gone (404). Verified by extended Playwright E2E (enter→edit→save on both + old routes 404) and `pnpm typecheck`/`lint`/`build` green.

## What We're NOT Doing

- **No shared edit-toggle helper / new shared tier.** The toggle is ~3-5 lines per consumer (`<Link href="?edit">` + `await searchParams` + stale guard + `key`-remount); below the abstraction bar. Mirror `topic-checks-section.tsx` inline in each feature. (Resolves the `change.md` "promote on 2nd consumer" tension toward keep-inline.)
- **No change to `PageShell`** (`src/components/layout/page-shell.tsx`). The subject header form is rendered feature-locally in place of the title/subtitle, not via a new `titleNode` slot.
- **No topic-check changes.** Topic checks keep their existing independent `?edit=<checkId>` CRUD. We are NOT folding them into one transactional Save.
- **No unsaved-changes guard.** Cancel / navigate-away discards silently, matching today's `/edit` route behavior.
- **No `?toast=` wiring in this slice.** Redirects ship bare; the toast flag is appended when S-16 lands.
- **No Shiki/langs change** — that is S-13 (`shiki-lang-source-of-truth`), a separate in-flight change touching only `render-markdown.tsx`.

## Implementation Approach

Two independent phases, one per feature, each self-contained and shippable: Phase 1 notes, Phase 2 subjects. Each converts the detail-page "Edit" button into a `?edit` `<Link>`, branches the server page to render the existing form in place, and deletes the corresponding `/edit` route. PRG is preserved by leaving the update actions' `redirect(bare path)` untouched. Tests are authored after the gate's `/simplify` pass (per the project review gate) and listed in each phase's success criteria.

## Critical Implementation Details

- **`?edit` dual meaning on the note page (Phase 1) — `note` is a reserved sentinel.** `?edit` now means either `note` (body form) or `<checkId>` (topic-check edit); the two are mutually exclusive states sharing one param. The page must branch: when `edit === 'note'`, render `NoteForm` and pass `editId={undefined}` to `TopicChecksSection`; otherwise pass `editId={edit}` as today. **Do not pass `'note'` into `TopicChecksSection` as `editId`** — its stale guard `if (editId && !editingCheck) redirect(bare)` (`topic-checks-section.tsx:25`) would misfire (no check has id `'note'`) and bounce the user out of body-edit. Verified necessary AND sufficient. This is the one non-obvious ordering in the slice; lock it with the no-redirect E2E (F3 below).
- **Header in edit mode (F1).** `PageShell.title` is a required `string` rendered as an unconditional `<h1>` (`page-shell.tsx:16,78-80`) — it cannot be emptied/hidden without editing PageShell. Rather than touch the shared primitive, edit mode passes an edit-label title (`"Edit note"` / `"Edit subject"`) — exactly what the deleted `/edit` routes did — so PageShell's `<h1>` reads the label, not the document title, and there is no duplicate with the form's own title field. Applies to BOTH phases.
- **Cancel/exit is navigation, not state.** Cancel = `<Link href="/notes/${id}">` / `<Link href="/subjects/${id}">` (bare path). Save redirects to the same bare path. Both unmount the form because `?edit` is gone — no client close handler.
- **Manual perf check uses a production build.** "Read view stays light" is a success criterion; verify the absence of CodeMirror in the default render via `pnpm build && pnpm start` (isolated port/dist), never `next dev` (lessons.md: dev timings are meaningless).

## Phase 1: Notes in-place edit

### Overview

Convert note-body editing from the `/notes/[id]/edit` route into a `?edit=note` branch on `/notes/[id]`, reusing `NoteForm`. Topic checks stay read-only below the form. Delete the edit route.

### Changes Required:

#### 1. Note detail page — branch on `?edit`

**File**: `src/app/(protected)/notes/[id]/page.tsx`

**Intent**: When `edit === 'note'`, render the existing `NoteForm` (body + subject) in place of the read-only body; otherwise render the current read view. Topic-checks section always renders below, read-only when in body-edit.

**Contract**: Reads existing `const { edit } = await searchParams`. Add `const isEditingNote = edit === 'note'`. `getSubjects()` is **already fetched** on this page (it powers the inline `NoteSubjectPicker`) — **reuse it**, do not add a query (F4). When `isEditingNote`: render `<NoteForm action={updateNote} note={note} subjects={subjects} />` instead of `<RenderMarkdown content={note.content} />` + the inline `NoteSubjectPicker`. Pass `editId={isEditingNote ? undefined : edit}` to `TopicChecksSection`.
**Header (F1):** `PageShell.title` is a required `string` rendered as an unconditional `<h1>` (`page-shell.tsx:16,78-80`) — it cannot be emptied or suppressed without changing PageShell. To avoid a duplicate title (PageShell `<h1>{note.title}` above `NoteForm`'s own title field), in edit mode pass `title="Edit note"` to PageShell (mirroring the deleted `/notes/[id]/edit` route, `edit/page.tsx:18`) and render `NoteForm` as its children; in read mode keep `title={note.title}`. No PageShell change.
**Actions slot (F2):** when `isEditingNote`, the PageShell `actions` slot shows a single "Cancel" `<Link href={`/notes/${id}`}>` — drop the "Edit" (redundant) and "Delete" (unsafe mid-edit) buttons. In read mode the actions stay as today, with the "Edit" button now `<Link href={`/notes/${id}?edit=note`}>` (was `/notes/${id}/edit`).

#### 2. Delete the note edit route

**File**: `src/app/(protected)/notes/[id]/edit/page.tsx` (delete) + its directory

**Intent**: Remove the now-redundant route; its fetch+render logic moved into the detail page's `?edit=note` branch.

**Contract**: `rm` the `edit/` route segment. Confirm no other file links to `/notes/[id]/edit` (grep — the only known reference is the detail-page Edit button changed in change #1).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Production build passes: `pnpm build`
- E2E passes incl. note in-place edit + `/notes/[id]/edit` 404/redirect: `pnpm test:e2e` (authored post-`/simplify` per the gate)

#### Manual Verification:

- `/notes/[id]` read view is light — no CodeMirror/form in the default render (verify in a production build, not `next dev`).
- Clicking "Edit" shows the body+subject form in place; topic checks remain listed read-only below.
- Saving redirects to `/notes/[id]` with updated content; Cancel returns without saving.
- Navigating directly to `/notes/[id]/edit` 404s.

**Implementation Note**: After automated verification passes, pause for human confirmation of the manual checks before proceeding to Phase 2.

---

## Phase 2: Subjects in-place edit

### Overview

Convert subject header (title/description) editing from the `/subjects/[id]/edit` route into a `?edit` branch on `/subjects/[id]`, reusing `SubjectForm` rendered feature-locally in place of the header. Delete the edit route.

### Changes Required:

#### 1. Subject detail page — read `?edit`, render form in place of header

**File**: `src/app/(protected)/subjects/[id]/page.tsx`

**Intent**: Add `searchParams` to the page; when `edit` is present, render `SubjectForm` (title/description) in place of the static header, keeping the note list below unchanged.

**Contract**: Add `searchParams: Promise<{ edit?: string }>` to the props and `const { edit } = await searchParams`; `const isEditing = edit !== undefined`. When `isEditing`, render `<SubjectForm action={updateSubject} subject={subject} />` as PageShell's children (above the note list).
**Header (F1):** same constraint as Phase 1 — `PageShell.title` is required and always rendered as `<h1>`. To avoid a duplicate title (static `<h1>{subject.title}` above `SubjectForm`'s own title field), in edit mode pass `title="Edit subject"` to PageShell (mirroring the deleted `/subjects/[id]/edit` route, `edit/page.tsx:17`) and pass `subtitle={undefined}`; in read mode keep `title={subject.title}` + `subtitle={subject.description ?? undefined}`. No PageShell change.
**Actions slot (F2):** when `isEditing`, the `actions` slot shows a single "Cancel" `<Link href={`/subjects/${id}`}>` — drop "New note" / "Edit" / "Delete". In read mode the actions stay as today, with the "Edit" button now `<Link href={`/subjects/${id}?edit`}>` (was `/subjects/${id}/edit`).

#### 2. Delete the subject edit route

**File**: `src/app/(protected)/subjects/[id]/edit/page.tsx` (delete) + its directory

**Intent**: Remove the redundant route; logic moved into the `?edit` branch.

**Contract**: `rm` the `edit/` route segment. Grep-confirm the only link to `/subjects/[id]/edit` was the detail-page Edit button changed in change #1.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Production build passes: `pnpm build`
- E2E passes incl. subject in-place edit + `/subjects/[id]/edit` 404/redirect: `pnpm test:e2e` (authored post-`/simplify` per the gate)

#### Manual Verification:

- `/subjects/[id]` shows the title/description read-only by default; the note list renders below.
- Clicking "Edit" swaps the header into the title/description form in place; the note list stays.
- Saving redirects to `/subjects/[id]` with updated title/description; Cancel returns without saving.
- Navigating directly to `/subjects/[id]/edit` 404s.

**Implementation Note**: After automated verification passes, pause for human confirmation of the manual checks before the review gate.

---

## Testing Strategy

### Unit Tests:

- None — both flows are server-component render + redirect; the project convention is E2E for rendering/navigation (consistent with S-13/S-01).

### Integration / E2E Tests:

Authored **after** the gate's `/simplify` pass (per CLAUDE.md review gate), reusing `e2e/helpers.ts` (`signUp`, `fillEditor`):

- `e2e/notes.spec.ts`: create a note → click Edit → confirm the form appears in place → change the body → save → assert updated content on `/notes/[id]` and form gone. Assert `GET /notes/[id]/edit` 404s (or redirects). **Assert `/notes/[id]?edit=note` does NOT redirect** (stays on the URL with the form visible) — this locks the `editId={undefined}` mitigation (F3); without it a regression that forwards `editId={edit}` would silently bounce the user out of body-edit.
- `e2e/subjects.spec.ts`: create a subject → click Edit → change title/description → save → assert updated header. Assert `GET /subjects/[id]/edit` 404s.

### Manual Testing Steps:

1. `pnpm build && pnpm start` (isolated port/dist). Open `/notes/[id]` → read view light, click Edit → form in place, checks read-only below → save → updated.
2. Hit `/notes/[id]/edit` directly → 404.
3. Open `/subjects/[id]` → Edit → title/description form in place → save → updated; `/subjects/[id]/edit` → 404.

## Performance Considerations

Read view stays light: the default `/notes/[id]` render keeps `RenderMarkdown` (server-only Shiki, zero client highlight bytes) and mounts the lazy CodeMirror island only in the `?edit=note` branch. No new client JS on the read path. (Independent of S-13's Shiki boot-cost work.)

## Migration Notes

No schema/data changes. Pure route+UI restructure. Rollback = restore the two deleted `/edit` route files and revert the detail-page Edit-button links.

## References

- Research: `context/changes/inline-edit-notes-and-subjects/research.md`
- Design: `context/changes/inline-edit-notes-and-subjects/change.md`
- Pattern to mirror: `src/features/topic-checks/topic-checks-section.tsx:22,25,43,59`
- PRG to preserve: `src/features/notes/actions/update-note.ts:44-48`, `src/features/subjects/actions/update-subject.ts:27-29`
- S-16 `?toast=` reader (future success-feedback): `context/changes/action-feedback-toasts/plan.md`
- Lessons: production-build perf measurement; `z.guid()` not `z.uuid()` — `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Notes in-place edit

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck` — 17f6ef8
- [x] 1.2 Linting passes: `pnpm lint` — 17f6ef8
- [x] 1.3 Production build passes: `pnpm build` — 17f6ef8
- [ ] 1.4 E2E passes incl. note in-place edit, `?edit=note` no-redirect assertion, + `/notes/[id]/edit` 404/redirect: `pnpm test:e2e`

#### Manual

- [ ] 1.5 Read view is light — no CodeMirror/form in default render (production build); edit-mode header reads "Edit note" (no duplicate title)
- [ ] 1.6 Edit shows body+subject form in place; topic checks read-only below; actions slot shows only Cancel
- [ ] 1.7 Save redirects to `/notes/[id]` updated; Cancel returns unsaved
- [ ] 1.8 `/notes/[id]/edit` 404s

### Phase 2: Subjects in-place edit

#### Automated

- [x] 2.1 Type checking passes: `pnpm typecheck` — aec7c33
- [x] 2.2 Linting passes: `pnpm lint` — aec7c33
- [x] 2.3 Production build passes: `pnpm build` — aec7c33
- [ ] 2.4 E2E passes incl. subject in-place edit + `/subjects/[id]/edit` 404/redirect: `pnpm test:e2e`

#### Manual

- [ ] 2.5 Read view shows title/description read-only; note list below; edit-mode header reads "Edit subject" (no duplicate title)
- [ ] 2.6 Edit swaps header into title/description form in place; note list stays; actions slot shows only Cancel
- [ ] 2.7 Save redirects to `/subjects/[id]` updated; Cancel returns unsaved
- [ ] 2.8 `/subjects/[id]/edit` 404s
