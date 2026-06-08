# New/existing Subject Selector on Create-Note — Plan

## Overview

Let the create-note form create a new subject inline, via a shared `SubjectSelect` (extracted from the
import flow) and an atomic subject-resolution arm added to `create_note_with_checks` (mirrors `import_notes`).

## Current State

- New/existing toggle lives only inline in `import-panel.tsx` (`subjectMode` + Input/Combobox).
- Note + card forms use a plain `Combobox` (existing subjects + "None") bound to `subject_id`.
- `createNote` → RPC `create_note_with_checks(p_note, p_checks)`, flat `subject_id`.
- `import_notes` RPC already resolves `{id}|{title}` atomically — the pattern to mirror.
- Import E2E (`e2e/import-notes.spec.ts`) uses `import-subject-new-mode` + `import-subject-title` testids — MUST be preserved.

## What We're NOT Doing

- No new-subject on the standalone card form (out of scope this change).
- No change to edit-note subject UI (existing Combobox stays).
- No data-model change beyond the subject-resolution arm.

## Phase 1: Atomic RPC + schema

#### 1. Migration — subject resolution in create_note_with_checks

**File**: `supabase/migrations/<ts>_create_note_with_checks_subject_title.sql` (new)

**Contract**: `create or replace function public.create_note_with_checks(p_note jsonb, p_checks jsonb)` —
unchanged except: resolve `v_subject_id := nullif(p_note->>'subject_id','')::uuid; if v_subject_id is null
and nullif(p_note->>'subject_title','') is not null then insert into public.subjects (title) values
(p_note->>'subject_title') returning id into v_subject_id; end if;` then insert the note with `v_subject_id`.
Keep SECURITY INVOKER, `set search_path=''`, explicit-column reads, the grants. Position read from
`p_note->>'position'` unchanged.

#### 2. Create-note schema gains subject_title

**File**: `src/features/notes/schemas.ts`

**Contract**: A create-specific note schema = `noteInputSchema.extend({ subject_title: subjectTitleSchema.optional() })`
used inside `createNoteWithChecksSchema` (edit keeps bare `noteInputSchema`). A `.refine` forbids both
`subject_id` (non-null) and `subject_title` set at once.

#### 3. createNote passes subject_title + position

**File**: `src/features/notes/actions/create-note.ts`

**Contract**: `position = (note.subject_id || note.subject_title) ? Date.now() : null`; pass `subject_title`
through in `p_note`.

## Phase 2: Shared component + form wiring

#### 4. SubjectSelect (new shared component)

**File**: `src/features/subjects/components/subject-select.tsx` (new)

**Contract**: Controlled. `value: SubjectChoiceT = { mode:'existing'; subjectId: string|null } | { mode:'new'; title: string }`,
`onChange`, `subjects`, `allowNone?: boolean`, `testIdPrefix`. Renders SegmentedToggle (`${prefix}-new-mode` /
`${prefix}-existing-mode`, existing disabled when no subjects) → new: Input (`${prefix}-title`); existing:
Combobox (options = `allowNone ? [None, ...subjects] : subjects`). Mirrors import-panel's current markup so its
testids are unchanged.

#### 5. NoteForm create mode uses SubjectSelect

**File**: `src/features/notes/components/note-form.tsx`

**Contract**: Create mode only: a local `SubjectChoiceT` state (default `{ mode:'existing', subjectId: defaultSubjectId }`)
drives `SubjectSelect` (allowNone, testIdPrefix `note-subject`); edit mode keeps the existing Combobox bound to
`subject_id`. At create submit, build `note.subject_id` / `note.subject_title` from the choice (new+empty title →
block + form error "Name the new subject."). Remove create-mode reliance on the form's `subject_id` field.

#### 6. import-panel uses SubjectSelect

**File**: `src/features/import/components/import-panel.tsx`

**Contract**: Replace the inline SegmentedToggle+Input/Combobox with `SubjectSelect` (allowNone false,
testIdPrefix `import-subject`), adapting its state to a single `SubjectChoiceT`. Preserve the exact testids +
the existing submit/validation behavior.

## Success Criteria

#### Automated

- `pnpm typecheck`, `pnpm lint`, `pnpm test` green.
- Migration applies cleanly (`supabase migration up` or `db reset`).

#### Manual

- New Note → "New subject" → name it → Create → lands on the note, subject created + assigned.
- New Note → "Existing" → pick one (or None) → Create → assigned as chosen.
- Import flow still works (new + existing subject) — its E2E testids unchanged.

## Progress

> `- [ ]` pending, `- [x]` done; append ` — <sha>`.

### Phase 1: Atomic RPC + schema

#### Automated

- [x] 1.1 Migration applies (`supabase migration up`/`db reset`) — a522764
- [x] 1.2 `pnpm typecheck` passes — a522764
- [x] 1.3 `pnpm lint` passes — a522764

### Phase 2: Shared component + form wiring

#### Automated

- [x] 2.1 `pnpm typecheck` passes — cfbd6e9
- [x] 2.2 `pnpm lint` passes — cfbd6e9
- [x] 2.3 `pnpm test` stays green — cfbd6e9

#### Manual

- [ ] 2.4 New Note → new subject → created + assigned
- [ ] 2.5 New Note → existing / None → assigned as chosen
- [ ] 2.6 Import flow still works (new + existing); testids unchanged
