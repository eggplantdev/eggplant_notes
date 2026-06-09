# Link an Unlinked Memory Card to an Existing Note — Implementation Plan

## Overview

A standalone memory card (`note_id = null`) currently has no way to be attached to an existing
note — the app only supports the reverse (`unlinkCardFromNote`). This plan adds the missing
inverse: a `linkCardToNote` action, a `getNotesForLinking` query, a shared `LinkCardToNoteDialog`,
and three conditionally-rendered triggers (cards listing, card view page, edit form). The card→note
data-model invariant ("a linked card shares its note's subject") is preserved by deriving the
card's subject server-side from the chosen note.

## Current State Analysis

- **Cards have two independent FKs**: `subject_id` (nullable) and `note_id` (nullable). They are
  coupled by an invariant: a linked card's `subject_id` always equals its note's `subject_id`.
- The invariant is enforced server-side at insert (`src/features/memory-cards/insert-cards-for-note.ts`
  reads `note.subject_id` and stamps each card) and at edit (`card-form.tsx` forces an unlink-confirm
  when a linked card's subject changes).
- **Unlink already exists**: `src/features/memory-cards/actions/unlink-card-from-note.ts` sets
  `note_id = null` (RLS-scoped, `.select('id').single()`, no redirect, revalidates `/notes/[id]` +
  `/memory-cards`). Its UI surfaces are `unlink-card-button.tsx` (note's card section) and the
  "Source note + Unlink" row in `card-form.tsx`.
- **All three card queries already select `note_id` + `subject_id`** (`memory-cards/queries.ts:118`
  list, `:144` edit, `:158` review), so every trigger surface can decide whether to render.
- **`getNotes`** (`notes/queries.ts`) filters subjects via `.in('subject_id', ids)` only for a
  non-empty array — it has **no `subject_id IS NULL` branch**, so the "None"/unfiled case needs a
  dedicated query.
- **Data-returning server actions are an established pattern** (`openrouter/actions/generate-cards.ts`
  returns a result object to a client component) — so `getNotesForLinking` fits as a server action
  callable from the client dialog.
- **`Combobox`** (`components/ui/combobox.tsx`) is client-side filter only (static `options`, cmdk
  search) — no async hook. We hand it the full subject-scoped note set; it filters in-browser.
- The listing page (`memory-cards/page.tsx`) and edit page (`[id]/edit/page.tsx`) already load
  `subjects`; the **card view page** (`[id]/page.tsx`) does not.
- **Testing convention**: unit tests are pure-logic only (`src/__tests__/*.test.ts`); mutating
  RLS-scoped actions (incl. `unlinkCardFromNote`) have no unit test. E2E lives under `e2e/`.

## Desired End State

A standalone card can be attached to any existing note from three places. The dialog scopes the
note search by a required subject, the card adopts the chosen note's subject on link, and the
trigger disappears once the card is linked. Verified by: linking from each surface attaches the
card, the card's subject matches the note's, and the source-note link appears on the edit page.

### Key Discoveries:

- Subject is derived from the **note**, not the dialog filter — `insert-cards-for-note.ts:12` is the
  exact pattern to mirror.
- `unlink-card-from-note.ts` is the structural template for the new action (validation, RLS-scoped
  `.select().single()`, `revalidatePath` set, no redirect).
- `CardActions` (`components/ui/card-actions.tsx`) already has a `deleteControl` slot pattern — add a
  parallel `linkControl` slot rather than hard-coding a button.
- The edit form's "Source note + Unlink" block (`card-form.tsx`, gated on `sourceNote && card`) is
  the mirror anchor: render a "Link to note" row in the `else` (unlinked) case.

## What We're NOT Doing

- Server-side note search / pagination inside the dialog (subject-scoping + client-side `Combobox`
  filter is sufficient; notes load capped at 200).
- A defensive "already linked?" precheck in the action — triggers are hidden for linked cards; the
  action trusts UI gating and overwrites (mirrors `unlinkCardFromNote`'s no-precheck design).
- Bulk linking, linking from the note side, drag-and-drop.
- Unit-testing the mutating action (against repo convention) — coverage is manual + one E2E spec.
- Any schema/migration change — both columns already exist.

## Implementation Approach

Build bottom-up: the data layer (action + query) first so the dialog has real contracts to call,
then the self-contained dialog, then wire the three triggers (each just conditionally renders the
dialog's trigger and passes the card's id + `subjects`), then the E2E spec last.

## Phase 1: Backend — link action + notes query

### Overview

Add the server-side primitives: the mutating link action and the subject-scoped notes fetch.

### Changes Required:

#### 1. Link action

**File**: `src/features/memory-cards/actions/link-card-to-note.ts` (new)

**Intent**: Attach a standalone card to an existing note, making the card adopt the note's subject
so the invariant holds. The structural mirror of `unlinkCardFromNote`.

**Contract**: `linkCardToNote(cardId: string, noteId: string): Promise<ActionResultT>`. Validates
both ids with the existing `memoryCardIdSchema` / `noteIdSchema` (shape-only `z.guid`). Re-reads the
note's `subject_id` (RLS-scoped `.eq('id', noteId).single()`; a missing/not-owned note → error →
failure). Updates the card `{ note_id: noteId, subject_id: note.subject_id }` with
`.eq('id', cardId).select('id').single()`. No redirect. Revalidates `/memory-cards`,
`/memory-cards/${cardId}`, `/notes/${noteId}`.

#### 2. Notes-for-linking query

**File**: `src/features/notes/queries.ts` (add `getNotesForLinking`)

**Intent**: Return the slim note options for one subject (or unfiled) to populate the dialog's
note-select. Subject-scoping is what bounds the payload.

**Contract**: `getNotesForLinking(subjectId: string | null, client?): Promise<{ id: string; title: string | null }[]>`.
Selects `id, title` from `notes`, ordered `created_at` desc, capped at 200 (comment the cap). When
`subjectId` is non-null → `.eq('subject_id', subjectId)`; when null → `.is('subject_id', null)`.
RLS scopes to owner. Reuses `runTableQuery`.

#### 3. Notes-for-linking server action wrapper

**File**: `src/features/notes/actions/get-notes-for-linking.ts` (new)

**Intent**: Expose `getNotesForLinking` to the client dialog (queries are server-only; the dialog is
a client component, like `generate-cards` is reached from `topic-generator`).

**Contract**: `'use server'`; `getNotesForLinkingAction(subjectId: string | null): Promise<{ id: string; title: string | null }[]>`.
Validates `subjectId` is null or a `z.guid`; delegates to `getNotesForLinking`. Read-only, no
revalidate.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- N/A for this phase (no UI yet) — exercised in Phase 3.

**Implementation Note**: After automated verification passes, proceed to Phase 2 (no manual UI to
test yet).

---

## Phase 2: Shared dialog component

### Overview

Build `LinkCardToNoteDialog`, the self-contained client component all three triggers mount.

### Changes Required:

#### 1. Link dialog

**File**: `src/features/memory-cards/components/link-card-to-note-dialog.tsx` (new)

**Intent**: Let the user pick a subject (which scopes a note search) and a note, then link. Mounted
only while open so its state starts fresh each time. On success: toast "Card linked" + refresh.

**Contract**: Props `{ cardId: string; cardSubjectId: string | null; subjects: SubjectOptionT[]; open: boolean; onOpenChange: (open: boolean) => void }`.

- Subject-select: existing `Combobox` with options `[{ value: NO_SUBJECT, label: 'None' }, ...subjects]`,
  value defaults to `cardSubjectId ?? NO_SUBJECT` (pre-fill "None" when unfiled). Required (no clear).
- Note-select: `Combobox` populated from `getNotesForLinkingAction(selectedSubjectId)`, refetched
  whenever the selected subject changes (effect keyed on subject). Shows a spinner while fetching;
  disabled during fetch; `emptyMessage="No notes in this subject."` when the result is empty.
- Link submit: disabled until a note id is selected; calls `linkCardToNote(cardId, noteId)` via
  `useActionTransition` with `successMessage: 'Card linked'`; on success calls `onOpenChange(false)`
  and `router.refresh()`.
- Reuses the `AlertDialog` (or `Dialog`) primitive consistent with `move-linked-cards-dialog.tsx` /
  `card-form.tsx`. `NO_SUBJECT` sentinel reused from the existing convention.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- N/A standalone — verified through the triggers in Phase 3.

**Implementation Note**: Proceed to Phase 3 once the component type-checks; it has no mount point yet.

---

## Phase 3: Wire the three triggers

### Overview

Mount the dialog from the cards listing, the card view page, and the edit form — each rendering its
trigger only when `note_id` is null.

### Changes Required:

#### 1. `CardActions` link slot

**File**: `src/components/ui/card-actions.tsx`

**Intent**: Add a `linkControl?: ReactNode` slot (parallel to `deleteControl`) so the listing can
inject a Link trigger without `CardActions` knowing about cards.

**Contract**: New optional prop `linkControl?: ReactNode`, rendered between Edit and the delete
control. No behavior change when omitted.

#### 2. Listing trigger

**File**: `src/features/memory-cards/components/memory-cards-list.tsx`

**Intent**: On unlinked rows, render a Link button that opens `LinkCardToNoteDialog`. The list needs
`subjects` to pass through.

**Contract**: `MemoryCardsList` gains a `subjects: SubjectOptionT[]` prop (passed from
`memory-cards/page.tsx`, which already loads `subjects`). In `renderAction`, pass
`linkControl={card.note_id ? undefined : <LinkCardButton cardId={card.id} cardSubjectId={card.subject_id} subjects={subjects} />}`.
A small `LinkCardButton` wrapper (new, colocated) owns the open state + dialog mount.

#### 3. Card view page trigger

**File**: `src/app/(protected)/memory-cards/[id]/page.tsx`

**Intent**: Show a Link button in the page actions when the card has no note.

**Contract**: Add `getSubjects()` to the existing `Promise.all`. When `card.note_id` is null, render
the `LinkCardButton` (same wrapper) alongside `CardActions` in the `actions` slot. Hidden otherwise.

#### 4. Edit form Link row

**File**: `src/features/memory-cards/components/card-form.tsx`

**Intent**: Mirror the "Source note + Unlink" row: when the card is unlinked, render a "Link to
note" row that opens the dialog.

**Contract**: The existing `{sourceNote && card && (...Unlink row)}` gets an `else` branch:
`{card && !card.note_id && (...Link row with LinkCardButton)}`. The two are mutually exclusive. The
form already receives `subjects`; pass them and `card.subject_id` through. On link, the dialog's
`router.refresh()` reloads the page so the Unlink row replaces the Link row.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Production build passes: `pnpm build`

#### Manual Verification:

- From the cards listing, an unlinked card shows a Link action; a linked card does not.
- Linking from the listing: pick subject → pick note → Link; the row's source note appears and the
  Link action is gone.
- From the card view page (`/memory-cards/[id]`), an unlinked card shows a Link button; linking
  attaches it and the button disappears.
- From the edit form, an unlinked card shows the "Link to note" row; after linking it is replaced by
  the "Source note + Unlink" row, and the subject field reflects the note's subject.
- Linking a card filed under subject A to a note under subject B re-files the card to B (subject
  picker shows B throughout).
- "None" subject shows unfiled notes; linking to one keeps the card unfiled.

**Implementation Note**: After automated verification passes, pause for manual confirmation across
all three surfaces before Phase 4.

---

## Phase 4: E2E test

### Overview

One Playwright spec protecting the user-visible invariant end-to-end.

### Changes Required:

#### 1. Link E2E spec

**File**: `e2e/link-card-to-note.spec.ts` (new)

**Intent**: Drive the real link path and assert the card adopts the note's subject.

**Contract**: Self-seeds via UI sign-up (per `e2e/helpers.ts` `uniqueEmail`). Creates a subject + a
note under it, creates a standalone card (different/no subject), opens the link dialog from one
surface, selects the subject + note, links, and asserts: the card's source note is shown and the
card's subject now matches the note's subject. Uses role/testid locators and wait-for-state (no
`waitForTimeout`); independent of other specs. Authored via the `/10x-e2e` skill workflow.

### Success Criteria:

#### Automated Verification:

- E2E suite passes: `pnpm test:e2e` (requires local Supabase up)
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- Spec is independent (passes in isolation and within the full suite).

**Implementation Note**: Author with `/10x-e2e`; confirm green before closing the change via the
`slice-review-gate`.

---

## Testing Strategy

### Unit Tests:

- None. Mirrors `unlinkCardFromNote` (no unit test for RLS-scoped mutating actions); no new
  pure-logic module is introduced.

### Integration Tests:

- None. No new API route; the action is exercised through the UI + E2E.

### Manual Testing Steps:

1. As `test@gmail.com`, create a standalone card with no subject; from the listing, Link it to a
   note under "JavaScript" → card becomes a JavaScript card with that source note.
2. Create a card under "Python"; link it to a "JavaScript" note → card re-files to JavaScript.
3. Open an unlinked card's edit page → "Link to note" row present; link → replaced by Unlink row.
4. Confirm a linked card shows no Link affordance on any surface.

## Migration Notes

None — both `note_id` and `subject_id` columns already exist; no data backfill.

## References

- Change identity + brainstormed shape: `context/changes/link-unlinked-card-to-note/change.md`
- Mirror action: `src/features/memory-cards/actions/unlink-card-from-note.ts`
- Subject-derivation pattern: `src/features/memory-cards/insert-cards-for-note.ts:12`
- Edit-form anchor (Unlink row): `src/features/memory-cards/components/card-form.tsx`
- Data-returning action precedent: `src/features/openrouter/actions/generate-cards.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend — link action + notes query

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck` — fd04b3b
- [x] 1.2 Linting passes: `pnpm lint` — fd04b3b

### Phase 2: Shared dialog component

#### Automated

- [x] 2.1 Type checking passes: `pnpm typecheck` — 80cdf67
- [x] 2.2 Linting passes: `pnpm lint` — 80cdf67

### Phase 3: Wire the three triggers

#### Automated

- [x] 3.1 Type checking passes: `pnpm typecheck` — 63123d8
- [x] 3.2 Linting passes: `pnpm lint` — 63123d8
- [x] 3.3 Production build passes: `pnpm build` — 63123d8

#### Manual

- [ ] 3.4 Listing: unlinked card shows Link, linked card does not
- [ ] 3.5 Listing: link flow attaches card, source note appears, Link action gone
- [ ] 3.6 Card view page: Link button shows when unlinked, disappears after linking
- [ ] 3.7 Edit form: Link row ↔ Unlink row are mutually exclusive; subject reflects note's subject
- [ ] 3.8 Cross-subject link re-files the card; "None" links to unfiled notes

### Phase 4: E2E test

#### Automated

- [ ] 4.1 E2E suite passes: `pnpm test:e2e` — DEFERRED: spec drove the full flow green once (note found + linked); reliable green/break verify deferred to a fresh local stack (degraded by repeated rebuilds this session)
- [x] 4.2 Type checking passes: `pnpm typecheck` — c2c6d74
- [x] 4.3 Linting passes: `pnpm lint` — c2c6d74

#### Manual

- [ ] 4.4 Spec is independent (passes in isolation and in the full suite)
