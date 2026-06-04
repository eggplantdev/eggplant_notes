# Edit-Note Refinements Implementation Plan

## Overview

A follow-up to S-14 (inline-edit-notes-and-subjects). Three changes that keep the note **read** surface light and tighten note management from the list:

1. Defer the topic-check editor so a plain note view mounts **zero** CodeMirror.
2. Move subject assignment into edit mode only (drop the read-view picker).
3. Add Edit + Delete shortcuts to each note card on the listing.

No schema, no data-model change, no new dependency. Every pattern already exists in-repo.

## Current State Analysis

- **`src/features/topic-checks/topic-checks-section.tsx`** (async Server Component) unconditionally renders `<TopicCheckForm key={editId ?? 'new'} …>` at the bottom (line 59). In pure read mode (no `?edit`), that is the always-present "Add a topic check" form — and it mounts `MarkdownEditor` → `dynamic({ ssr:false })` CodeMirror. Because `dynamic` fetches+mounts its chunk on first render, **every note read fetches and hydrates an editor it doesn't need.** The note body, by contrast, is server `RenderMarkdown` in read mode (S-14) and only becomes an editor under `?edit=note`.
- **`src/app/(protected)/notes/[id]/page.tsx`** renders `NoteSubjectPicker` in the read branch (line 71). The edit branch (`NoteForm`, line 68) already has its own subject `Combobox` (`note-form.tsx:110-125`). So subject selection is duplicated across read and edit.
- **`src/features/notes/components/note-subject-picker.tsx`** + **`src/features/notes/actions/assign-subject.ts`** (`assignNoteSubject`) exist solely to serve that read-view picker. Grep confirms no other consumer and no test references.
- **`src/features/notes/components/notes-list.tsx`** is a thin client wrapper over `AnimatedCardList`. It passes `getHref`, `renderTitle`, `renderSubtitle` but **not** `renderAction`.
- **`src/components/motion/animated-card-list.tsx`** already exposes an optional `renderAction(item)` slot (top-right of the card). The whole card is a `<Link>`, so an interactive action must `preventDefault`/`stopPropagation` (documented at lines 18-21; precedent `SubjectCardNewNoteButton`). The file also carries an e2e TODO (line 39): list rows became `<div>`/`motion.div` (no `<ul>/<li>`), so stale `getByRole('listitem')`/`locator('li')` locators in `notes.spec`/`subjects.spec` need fixing.
- **`src/features/notes/delete-note-button.tsx`** confirms via `AlertDialog`, fires `deleteNote` in a transition (which redirects to `/notes` on success), surfaces failure inline + toast. Its `AlertDialogTrigger` button has **no** `stopPropagation` today — fine on the detail page (not inside a Link), but inside a list card `<Link>` it would trigger navigation.

## Desired End State

- Opening a note (`/notes/[id]` with no `?edit`) ships **no CodeMirror chunk** — verifiable in the Network tab / via a bundle check: the code-mirror chunk is requested only after clicking "Add check" or visiting `?edit=<checkId>`.
- The note detail read view shows no Subject picker; subject is changed by entering edit mode. `NoteSubjectPicker` and `assignNoteSubject` no longer exist in the tree.
- Each note card on `/notes` has working **Edit** and **Delete** text buttons that do not trigger card navigation; Delete confirms via the existing dialog and removes the row.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build` all green (e2e list-view locators updated for the new DOM).

### Key Discoveries:

- Deferred mount is a real download win **only on the detail page** — there's no body editor warming the chunk in read mode, unlike `/notes/new` (`topic-check-form.tsx:25`, `markdown-editor.tsx:8-13`).
- The detail page already separates concerns: edit-existing-check rides `?edit=<checkId>` (server re-render), add-check is the always-on form. Only the add form needs gating; the edit path is untouched.
- `AnimatedCardList.renderAction` exists and is unused by notes — no primitive change needed (`animated-card-list.tsx:21,51-58`).
- In-card action contract: `preventDefault` + `stopPropagation` then act (`subject-card-new-note-button.tsx:15-19`).

## What We're NOT Doing

- No list-**inline** editing — the "Edit" shortcut navigates to the detail page in edit mode (`?edit=note`); S-14's inline edit _is_ the detail page, there is no edit-on-the-list-row.
- No change to the topic-check **edit-existing** flow (`?edit=<checkId>` stays server-driven).
- No change to `AnimatedCardList` itself, to `DeleteNoteButton`'s dialog/confirm UX, or to the note body editor.
- No icon-button or dropdown-menu affordance for list actions — text buttons (decided).
- No subject-assignment affordance anywhere except the edit form.
- No schema, migration, or new dependency.

## Implementation Approach

Three independent phases, each shippable and verifiable on its own. Phase 1 introduces one small client component; Phase 2 is deletions + one removed render; Phase 3 wires an existing slot and makes `DeleteNoteButton` list-safe. The per-slice gate (review fan-out → `/simplify` → tests → archive) runs after all three land — the test layer (including the e2e locator fix) is authored last, against the cleaned-up code.

## Phase 1: Defer the add-check editor

### Overview

Stop rendering the add-mode `TopicCheckForm` on read. Gate it behind an on-demand toggle so CodeMirror mounts only when the user chooses to add a check (the edit-existing path keeps using `?edit=<checkId>`).

### Changes Required:

#### 1. New on-demand add-check toggle

**File**: `src/features/topic-checks/add-topic-check.tsx` (new, `'use client'`)

**Intent**: Hold the open/closed state for the "add a check" form so the async server `TopicChecksSection` can defer mounting `TopicCheckForm` (and its CodeMirror) until the user clicks. Closed → render an "Add check" button only. Open → render `TopicCheckForm` in add mode (no `check` prop). On a successful add the form collapses back to the button.

**Contract**: `function AddTopicCheck({ noteId }: { noteId: string })`. Internal `useState(false)` for open state. Renders `<Button>Add check</Button>` when closed; `<TopicCheckForm noteId={noteId} onAdded={() => setOpen(false)} />` when open. Collapse is driven by a new optional `onAdded` callback on `TopicCheckForm` (see change 2).

#### 2. Add a collapse hook to the form's success path

**File**: `src/features/topic-checks/topic-check-form.tsx`

**Intent**: Let the add-mode caller collapse the form after a successful create, without disturbing the edit-mode behavior (which navigates back to `/notes/[id]`). Today create-success calls `form.reset()`; it should also notify the parent so it can close.

**Contract**: Add optional prop `onAdded?: () => void` to `TopicCheckFormPropsT`. In `onSubmit`, on a successful **create** (the `else` branch after `form.reset()`), call `onAdded?.()`. Edit-success path (`router.push`) unchanged.

#### 3. Stop rendering the always-on add form in the section

**File**: `src/features/topic-checks/topic-checks-section.tsx`

**Intent**: Replace the unconditional `<TopicCheckForm key={editId ?? 'new'} …>` with: when `editId` resolves to an existing check, render `TopicCheckForm` seeded for that check (edit mode, as today); otherwise render `<AddTopicCheck noteId={noteId} />` (the collapsed toggle). The stale-`?edit` redirect guard stays.

**Contract**: After the `editingCheck` lookup + stale-guard redirect, the trailing render becomes: `editingCheck ? <TopicCheckForm key={editId} noteId={noteId} check={editingCheck} /> : <AddTopicCheck noteId={noteId} />`. The `key` is only needed on the edit form now.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Build succeeds: `pnpm build`

#### Manual Verification:

- Visiting `/notes/[id]` (no `?edit`) requests **no** code-mirror chunk (Network tab); clicking "Add check" then loads it and shows the form.
- Adding a check succeeds, the new check appears in the list, and the form collapses back to the "Add check" button.
- Editing an existing check via its Edit link still opens the seeded form (`?edit=<checkId>`) and saves.
- Error on add keeps the form open with the inline error + toast.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Subject select → edit view only

### Overview

Remove the read-view subject picker and its now-dead supporting code. Subject assignment lives only in the edit form's existing `Combobox`.

### Changes Required:

#### 1. Drop the picker from the detail read branch

**File**: `src/app/(protected)/notes/[id]/page.tsx`

**Intent**: Remove the `<NoteSubjectPicker …>` render (and its import) from the read branch; the read view shows just `RenderMarkdown`. `subjects` is still fetched for the edit branch's `NoteForm`, so the `getSubjects()` read stays.

**Contract**: Delete the `NoteSubjectPicker` JSX block (lines 71-75) and its import (line 9). The read branch becomes `<RenderMarkdown content={note.content} />` alone.

#### 2. Delete the dead component + action

**File**: `src/features/notes/components/note-subject-picker.tsx` (delete), `src/features/notes/actions/assign-subject.ts` (delete)

**Intent**: Both are unused after change 1 (grep-confirmed: only consumer was the detail page, no tests). Remove them so the feature stays `rm -rf`-clean with no orphans.

**Contract**: File deletions. Confirm no remaining import of `NoteSubjectPicker` or `assignNoteSubject` repo-wide after removal.

### Success Criteria:

#### Automated Verification:

- No dangling references: `grep -rn "NoteSubjectPicker\|assignNoteSubject\|assign-subject\|note-subject-picker" src/` returns nothing
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Build succeeds: `pnpm build`

#### Manual Verification:

- The note detail read view shows no Subject control.
- Entering edit mode (`?edit=note`) still shows the subject `Combobox`, and changing + saving persists the new subject.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: List edit/delete shortcuts

### Overview

Surface Edit and Delete on each note card via the existing `renderAction` slot, without breaking card navigation, and fix the stale list-view e2e locators flagged in the primitive.

### Changes Required:

#### 1. Make `DeleteNoteButton` safe inside a card Link

**File**: `src/features/notes/delete-note-button.tsx`

**Intent**: When the button lives inside the list card `<Link>`, opening the confirm dialog must not trigger navigation. Add `preventDefault`/`stopPropagation` to the trigger button's click. This is harmless on the detail page (no enclosing Link).

**Contract**: Add `onClick={(e) => { e.preventDefault(); e.stopPropagation() }}` to the `<Button>` inside `AlertDialogTrigger` (Radix still opens the dialog via the trigger). Dialog content is portaled, so inner clicks already don't bubble to the card.

#### 2. A list Edit shortcut

**File**: `src/features/notes/components/note-card-actions.tsx` (new, `'use client'`) — or inline in `notes-list.tsx`

**Intent**: Render the per-card Edit + Delete pair for the `renderAction` slot. Edit is a client button that `preventDefault`/`stopPropagation`s then routes to `/notes/[id]?edit=note` (mirrors `SubjectCardNewNoteButton`). Delete renders `<DeleteNoteButton id={note.id} />`. Text buttons (decided).

**Contract**: `function NoteCardActions({ noteId }: { noteId: string })` returning a flex row of an Edit `<Button variant="outline" size="sm">` (router.push) + `<DeleteNoteButton id={noteId} />`. One component per file (project rule).

#### 3. Wire the slot from `NotesList`

**File**: `src/features/notes/components/notes-list.tsx`

**Intent**: Pass `renderAction={(note) => <NoteCardActions noteId={note.id} />}` to `AnimatedCardList`. No other change.

**Contract**: Add the `renderAction` prop. `NoteListItemT` already carries `id`.

#### 4. Fix the stale list-view e2e locators

**File**: `e2e/notes.spec.ts`, `e2e/subjects.spec.ts` (whichever assert list rows)

**Intent**: The list DOM is `<div>`/`motion.div`, not `<ul>/<li>` (the TODO at `animated-card-list.tsx:39`). Replace `getByRole('listitem')`/`locator('li')` list assertions with locators that match the new card DOM (e.g. by card title link / test id). Remove the resolved TODO comment from the primitive.

**Contract**: Update the affected locators; assert the new Edit/Delete actions appear per card. Delete the `TODO(e2e)` comment block in `animated-card-list.tsx` once specs are green.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit tests pass: `pnpm test`
- E2E pass (list views + new shortcuts): `pnpm test:e2e`
- Build succeeds: `pnpm build`

#### Manual Verification:

- Each note card shows Edit + Delete; clicking the card body still navigates to the note.
- Edit opens the note already in edit mode (`?edit=note`).
- Delete opens the confirm dialog (no navigation), confirms, removes the row, and toasts.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation.

---

## Testing Strategy

### Unit Tests:

- No new pure logic to unit-test (all changes are wiring/UI). Existing unit suite must stay green.

### Integration / E2E Tests:

- `/notes/[id]` read: assert the topic-check add form is collapsed (button visible, no form fields); clicking "Add check" reveals the form.
- Add a check → it appears and the form collapses.
- Edit-existing-check via `?edit=<checkId>` still works.
- Detail read view has no Subject control; edit mode does and persists a change.
- Notes list: Edit button → detail in edit mode; Delete → confirm dialog → row removed; clicking card body navigates.
- Updated list-view locators (no `getByRole('listitem')`).

### Manual Testing Steps:

1. Open a note; confirm via Network tab that no code-mirror chunk loads until "Add check" is clicked.
2. Add a check; confirm collapse-after-add.
3. Confirm subject control is edit-only.
4. From `/notes`, exercise Edit and Delete shortcuts and confirm card navigation still works on the body.

## Performance Considerations

The core win: the note read view no longer downloads/parses/hydrates CodeMirror. The chunk is fetched on demand (and cached after first fetch in a session). No new runtime cost on the list — `renderAction` adds two small buttons per card.

## References

- Change identity + scope: `context/changes/edit-note-refinements/change.md`
- Deferred-editor precedent: `src/features/notes/note-form.tsx` (empty `checks: []` + "Add check"), `src/components/markdown/markdown-editor.tsx:8-13`
- In-card action precedent: `src/features/subjects/components/subject-card-new-note-button.tsx:15-19`
- `renderAction` slot: `src/components/motion/animated-card-list.tsx:21,51-58`
- E2E list-DOM TODO: `src/components/motion/animated-card-list.tsx:39`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Defer the add-check editor

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck` — d5e0ff3
- [x] 1.2 Linting passes: `pnpm lint` — d5e0ff3
- [x] 1.3 Build succeeds: `pnpm build` — d5e0ff3

#### Manual

- [x] 1.4 Read view requests no code-mirror chunk; "Add check" loads it and shows the form — d5e0ff3
- [x] 1.5 Adding a check succeeds, appears in the list, and the form collapses to the button — d5e0ff3
- [x] 1.6 Editing an existing check via `?edit=<checkId>` still opens + saves — d5e0ff3
- [x] 1.7 Error on add keeps the form open with inline error + toast — d5e0ff3

### Phase 2: Subject select → edit view only

#### Automated

- [x] 2.1 No dangling references (grep `NoteSubjectPicker`/`assignNoteSubject`/`assign-subject`/`note-subject-picker` returns nothing) — 8b92eb6
- [x] 2.2 Type checking passes: `pnpm typecheck` — 8b92eb6
- [x] 2.3 Linting passes: `pnpm lint` — 8b92eb6
- [x] 2.4 Build succeeds: `pnpm build` — 8b92eb6

#### Manual

- [x] 2.5 Detail read view shows no Subject control — 8b92eb6
- [x] 2.6 Edit mode shows the subject Combobox; change + save persists — 8b92eb6

### Phase 3: List edit/delete shortcuts

#### Automated

- [x] 3.1 Type checking passes: `pnpm typecheck` — 88ed981
- [x] 3.2 Linting passes: `pnpm lint` — 88ed981
- [ ] 3.3 Unit tests pass: `pnpm test` (deferred to gate test step)
- [ ] 3.4 E2E pass (list views + new shortcuts): `pnpm test:e2e` (deferred to gate test step)
- [x] 3.5 Build succeeds: `pnpm build` — 88ed981

#### Manual

- [ ] 3.6 Each card shows Edit + Delete; card body still navigates
- [ ] 3.7 Edit opens the note in edit mode (`?edit=note`)
- [ ] 3.8 Delete confirms (no navigation), removes the row, toasts
