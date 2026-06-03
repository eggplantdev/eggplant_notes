# Attach Topic Checks (S-02) Implementation Plan

## Overview

Add topic-check CRUD (FR-012–015) on top of the existing note. A topic check is a recall
prompt that belongs to a note: a required **question** plus an optional **example** and an
optional **code-block context**. Users attach checks to a note, edit them, delete them, and
see all checks on a given note — all inline on the note detail page (`/notes/[id]`).

The `topic_checks` table already exists from F-02. This slice adds two content columns, the
write path (Server Actions mirroring S-01's notes layer), the read helper, and the inline
UI. The SM-2 scheduling columns (`ease_factor`/`interval_days`/`repetitions`/`due_at`) stay
**unwritten** — S-03 (close-recall-loop) owns the review write path.

## Current State Analysis

What exists, from research of the repo at `dafecd8`:

- **Table** (`supabase/migrations/20260603070945_init_notes_topic_checks_review_events.sql`):
  `topic_checks` has `id`, `user_id` (`not null default auth.uid()`, FK→`auth.users` cascade),
  `note_id` (`not null` FK→`notes` cascade), `prompt text not null`, the four SM-2 columns
  (present but unwritten), `created_at`, `updated_at`. RLS is enabled with per-action
  `(select auth.uid()) = user_id` policies for `authenticated`. Indexes: `(user_id)`,
  `(note_id)`, `(user_id, due_at)`. Cascade chain: `notes → topic_checks → review_events`.
- **Write pattern** (S-01, `src/features/notes/`): `run-note-action.ts` is a generic
  `runNoteAction<TInput, TRow>(schema, input, call)` that validates with Zod, creates the
  server client, runs a PostgREST write ending in `.select().single()`, and returns a
  `{ success } | { error }` envelope (mutations _return_ errors for inline display, unlike
  reads which throw). Actions (`create/update/delete-note.ts`) are `'use server'`, send
  **only payload fields — never `user_id`** (DB defaults `auth.uid()` + RLS `with check`),
  and `revalidatePath` + `redirect` on success.
- **Read pattern**: `queries.ts` helpers use `runTableQuery` (throws → error boundary) and
  accept an **injectable** `SupabaseClient<Database>` (defaulting to `createClient()`) so
  Playwright can call them with a `signInWithPassword` client. `types.ts` re-exports the row
  type from the generated `Database` (`src/lib/supabase/types.ts`).
- **topic-checks scaffolding already present** from F-02: `src/features/topic-checks/types.ts`
  (re-exports `TopicCheckT` from `Database`) and `queries.ts` (`getTopicChecksDue`, the S-03
  read helper). These are extended, not recreated.
- **UI patterns**: note detail page (`src/app/(protected)/notes/[id]/page.tsx`) is a Server
  Component rendering `RenderMarkdown` (server-only Shiki, dual-theme). The note form
  (`note-form.tsx`) uses `useAppForm` (TanStack Form) + a lazy `ssr:false` CodeMirror island
  (`code-mirror-editor.tsx` via `note-editor.tsx`) + `markdown-preview.tsx`. Delete uses a
  shadcn `AlertDialog` in a client island (`delete-note-button.tsx`) firing a Server Action
  inside `useTransition`, with `e.preventDefault()` to keep the dialog open on failure.
- **Second dialog reference** from the merged S-05 work:
  `src/features/account/components/delete-account-dialog.tsx`.
- **Generated types** flow from `src/lib/supabase/types.ts`; both Supabase factories are typed
  `<Database>`. Adding columns requires a typegen regen so `TopicCheckT` picks up the new
  fields automatically.

## Desired End State

On a note's detail page, the user sees a "Topic checks" section listing every check attached
to that note (question rendered, optional example + code context rendered with Shiki
highlighting). They can add a new check via an inline CodeMirror-backed form, edit any
existing check in that same form (one editor mounted at a time), and delete a check behind an
AlertDialog confirmation. All operations are RLS-scoped: a user only ever sees or mutates
their own checks. Verified by a Playwright spec covering full CRUD, a Shiki-highlight
assertion, and a two-account isolation check on the new mutation path.

### Key Discoveries:

- `topic_checks.prompt` is `not null`; `example`/`code_context` will be **nullable** (FR-012:
  "optional"). The write path must send `null`/omit, not empty string, for blank optionals.
- `runNoteAction` is already generic over `<TInput, TRow>` despite its name — topic-checks is
  its **second consumer**, which (per the AGENTS.md promotion rule) is the trigger to lift it
  to a shared `src/lib/supabase/run-table-action.ts`.
- Mutations must **never send `user_id` or `due_at`** — `user_id` defaults to `auth.uid()`;
  the SM-2 columns keep their F-02 defaults so S-03's scheduling write path stays the sole
  owner. Insert payload is `{ note_id, prompt, example, code_context }` only.
- Next 16 dynamic route `params` is a `Promise` (already handled in the detail page).
- New migration timestamp must sort after `20260603092554` (the S-05 RPC migration).

## What We're NOT Doing

- **Not** writing any SM-2 scheduling column (`ease_factor`/`interval_days`/`repetitions`/
  `due_at`) — that is S-03's exclusive write path. New checks keep the F-02 fresh-card defaults.
- **Not** building the review/rating loop, due-list surfacing, or dashboard (S-03/S-04).
- **Not** adding new routes — topic checks live inline on `/notes/[id]` (no
  `/notes/[id]/topic-checks/*` pages).
- **Not** paginating the per-note check list (a note's checks are few; the S-01 list-pagination
  follow-up is unrelated).
- **Not** touching the notes write/read layer beyond the `runNoteAction` promotion.

## Implementation Approach

Mirror S-01's vertical exactly, one tier down (child entity scoped by `note_id`). Schema first
so generated types carry the new fields into every downstream layer; then the write/read layer
(shared action wrapper + Zod schema + actions + read helper); then the inline UI on the detail
page (server-rendered list + one client island for the toggled add/edit form + an AlertDialog
delete island); then E2E.

## Critical Implementation Details

**State sequencing (Phase 3).** The inline form is a single CodeMirror island reused for both
add and edit — only one editor is mounted at a time. The detail page (Server Component) renders
the check list and passes it to a client `TopicChecksSection` island that owns an
`editingId: string | undefined` state: `undefined` → the form is in "add" mode; a row id → the
form is seeded with that check and submits the update action. After a successful mutation the
Server Action `revalidatePath('/notes/[id]')`s and the island resets `editingId` to `undefined`.

**User experience spec (Phase 3).** Mounting multiple CodeMirror islands is the cost being
avoided — exactly one editor instance exists regardless of how many checks the note has.
Code context renders through the **server-only** Shiki `RenderMarkdown` in the list (zero
highlight bytes shipped per check), matching S-01's read view; the live edit preview reuses the
lighter client `markdown-preview.tsx`.

## Phase 1: Schema + typegen

### Overview

Add the two optional content columns and regenerate the typed `Database` so every downstream
layer sees `example` and `code_context`.

### Changes Required:

#### 1. New migration

**File**: `supabase/migrations/<timestamp>_add_topic_check_content_columns.sql` (timestamp
sorting after `20260603092554`)

**Intent**: Add the optional example and code-block-context fields FR-012 calls for, without
touching the existing `prompt`, RLS policies, or SM-2 columns.

**Contract**: `alter table topic_checks add column example text;` and `add column code_context
text;` — both **nullable** (no `not null`, no default). No new RLS policies needed (the
existing per-action `topic_checks_*_own` policies already gate the whole row). No index changes.

#### 2. Regenerate Database types

**File**: `src/lib/supabase/types.ts`

**Intent**: Refresh the generated types so `TopicCheckT` (and the insert/update types) carry the
two new nullable columns.

**Contract**: Run the project's Supabase typegen command against the local stack after the
migration applies; commit the regenerated file. `src/features/topic-checks/types.ts` needs no
edit — it already re-exports `Database['public']['Tables']['topic_checks']['Row']`.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly on a reset local stack: `supabase db reset`
- New columns exist and are nullable (via `pg_catalog`, not `information_schema` — see lessons):
  `psql … -c "\d topic_checks"` shows `example` / `code_context` as nullable `text`
- Type checking passes: `pnpm typecheck` (or `pnpm tsc --noEmit`)
- Generated `types.ts` includes `example` and `code_context` in the `topic_checks` Row/Insert types

#### Manual Verification:

- `supabase db reset` then a manual insert with both columns null and with both populated both succeed

**Implementation Note**: After this phase and all automated verification passes, pause for manual
confirmation before proceeding.

---

## Phase 2: Write + read layer

### Overview

The full server-side surface for topic-check CRUD: shared action wrapper, Zod schema, three
Server Actions, and the per-note read helper.

### Changes Required:

#### 1. Promote the action wrapper to a shared tier

**File**: `src/lib/supabase/run-table-action.ts` (new); update `src/features/notes/` to import it

**Intent**: `runNoteAction` is generic over `<TInput, TRow>` and is now needed by a second
feature — the AGENTS.md promotion rule says lift it to the shared infra tier on the 2nd consumer.

**Contract**: Move the body of `src/features/notes/run-note-action.ts` to
`runTableAction<TInput, TRow>(schema, input, call)` in `src/lib/supabase/run-table-action.ts`
(same signature, same `{ success: true; data } | { success: false; error }` envelope, same
`PostgrestSingleResponse` contract). Re-point the three notes actions (`create/update/delete-note.ts`)
and delete the old `run-note-action.ts`. Keep `NoteActionResultT` semantics as the generic
`{ data, error }` result type (rename to a neutral `TableActionResultT` in the shared file).

#### 2. Topic-check Zod schema

**File**: `src/features/topic-checks/schemas.ts` (new)

**Intent**: Validate create/update input — question required, example + code context optional.

**Contract**: `prompt` = trimmed `min(1)` / `max(...)`; `example` and `code_context` =
optional, empty-string-coerced-to-`undefined` so blank fields persist as SQL `null`, not `''`.
Export the composed `topicCheckInputSchema`, a `topicCheckIdSchema` (`z.uuid`), and the inferred
`TopicCheckInputT`. Mirror `src/features/notes/schemas.ts`.

#### 3. Create / update / delete Server Actions

**File**: `src/features/topic-checks/actions/{create,update,delete}-topic-check.ts` (new)

**Intent**: The three mutations, scoped by RLS, surfacing inline errors via the shared wrapper.

**Contract**: All `'use server'`, all return `ActionResultT` (`src/types/action`), all use
`runTableAction`. `create` takes `(noteId, input)`, inserts `{ note_id: noteId, prompt, example,
code_context }` — **never `user_id` or any SM-2 column** — `.select('id').single()`. `update`
takes `(id, input)`, `.update({...}).eq('id', id).select('id').single()`. `delete` takes `(id)`,
`.delete().eq('id', id)`. Each `revalidatePath` the owning note's detail path. Unlike notes,
these **do not `redirect`** (the user stays on the note page) — return the success result so the
island can reset its editing state. Mirror `create-note.ts` minus the redirect.

#### 4. Per-note read helper

**File**: `src/features/topic-checks/queries.ts` (extend existing)

**Intent**: Fetch all checks for one note (FR-015), RLS-scoped, injectable client for E2E.

**Contract**: Add `getTopicChecksForNote(noteId: string, client?: SupabaseClient<Database>):
Promise<TopicCheckT[]>` using `runTableQuery`, `.from('topic_checks').select('*').eq('note_id',
noteId).order('created_at', { ascending: true })`. Leave the existing `getTopicChecksDue`
untouched. Keep the injectable-client signature (lessons: Playwright needs it).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint` (catches import order + the moved wrapper's importers)
- Build passes: `pnpm build` (confirms the notes actions still resolve after the promotion)

#### Manual Verification:

- Notes CRUD still works end-to-end after the `runNoteAction → runTableAction` promotion (no regression)

**Implementation Note**: After this phase and all automated verification passes, pause for manual
confirmation before proceeding.

---

## Phase 3: Inline UI on note detail

### Overview

Surface the checks on `/notes/[id]`: a server-rendered list with Shiki, and one client island
hosting the toggled add/edit CodeMirror form plus per-row AlertDialog delete.

### Changes Required:

#### 1. Fetch + render the list on the detail page

**File**: `src/app/(protected)/notes/[id]/page.tsx` (extend)

**Intent**: Load the note's checks server-side and render a "Topic checks" section below the note
body.

**Contract**: Call `getTopicChecksForNote(id)` in the existing Server Component; pass the array
into a new `TopicChecksSection` client island. Render an empty state when there are none. Each
check's `prompt`, and (when present) `example` / `code_context`, render through the server-only
`RenderMarkdown` so code highlights with zero client highlight bytes.

#### 2. Topic-checks section island (list rows + toggled form)

**File**: `src/features/topic-checks/topic-checks-section.tsx` (new, `'use client'`)

**Intent**: Own the `editingId` state and render the single add/edit form + the list of rows
with edit/delete controls.

**Contract**: Props: `{ noteId: string; checks: TopicCheckT[] }`. Holds `editingId: string |
undefined`. Renders `TopicCheckForm` once (add mode when `editingId` is undefined; seeded edit
mode otherwise) and a row per check with an Edit button (sets `editingId`) and a
`DeleteTopicCheckButton`. On a successful action, reset `editingId`. One component per file
(react rule) — the form, the row, and the delete button are separate files.

#### 3. Topic-check form (reuses CodeMirror island)

**File**: `src/features/topic-checks/topic-check-form.tsx` (new, `'use client'`)

**Intent**: `useAppForm` form for create/edit, reusing S-01's lazy CodeMirror editor for the
code-bearing fields.

**Contract**: Mirror `note-form.tsx`: `prompt` as a validated `AppField`; `example` and
`code_context` in form state, with `code_context` edited via the existing `NoteEditor`
CodeMirror island + `MarkdownPreview`. A discriminated `props` union (`check?` present → edit,
calls `updateTopicCheck(id, value)`; absent → create, calls `createTopicCheck(noteId, value)`).
On `result.success`, call an `onDone` prop so the section resets `editingId`; on failure set
inline `FormError`. Validate `prompt` `onBlur` + `onSubmit` (no eager error — matches S-01).

#### 4. Delete button (AlertDialog)

**File**: `src/features/topic-checks/delete-topic-check-button.tsx` (new, `'use client'`)

**Intent**: Confirm destructive delete (cascades to `review_events`) before firing the action.

**Contract**: Mirror `delete-note-button.tsx`: AlertDialog "Delete this topic check?" copy
warning it removes review history, destructive action inside `useTransition`,
`e.preventDefault()` to keep the dialog open on failure. Props: `{ id: string }`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Production build passes: `pnpm build`

#### Manual Verification:

- On a note, the "Topic checks" section shows an empty state, then lists a check after adding one
- Add a check with a fenced code block in code_context → it renders syntax-highlighted (not flat text)
- Edit swaps the single form into edit mode (only one editor present), saves, and the row updates
- Delete shows the AlertDialog, confirms, and the row disappears
- Optional `example`/`code_context` left blank persist as null and render cleanly (no empty boxes)
- Layout usable down to ~360px (the detail page is mobile-relevant per NFR)

**Implementation Note**: After this phase and all automated verification passes, pause for manual
confirmation before proceeding.

---

## Phase 4: E2E

### Overview

A Playwright spec proving full CRUD, code highlighting, and per-account isolation on the new
mutation path.

### Changes Required:

#### 1. Topic-checks E2E spec

**File**: `e2e/topic-checks.spec.ts` (new)

**Intent**: Cover FR-012–015 end-to-end through the UI and re-prove RLS on the new write path.

**Contract**: Mirror `e2e/notes.spec.ts` for the CRUD/highlight portion (sign up via UI, create
a note, add a topic check with a code block, assert it lists + the code is Shiki-highlighted,
edit it, delete it). Add an isolation assertion mirroring `e2e/isolation.spec.ts`: using a
second account's `signInWithPassword` supabase-js client (per the lessons rule — not browser
cookie reuse), assert it cannot read account A's topic checks, and the `getTopicChecksForNote`
read helper (injectable client) returns empty across accounts. Account for the known local-GoTrue
signup flake — re-run once if 1–2 specs flake against a warm server.

### Success Criteria:

#### Automated Verification:

- E2E suite passes: `pnpm test:e2e` (local Supabase stack up; prod build + system Chrome per config)
- Isolation assertion fails on a deliberately broken control (negative-control verified once), then passes

#### Manual Verification:

- The CRUD spec exercises the same flow a user would; no console errors during the run

**Implementation Note**: After this phase and all automated verification passes, pause for manual
confirmation. This is the final phase — on success the change is ready for `/10x-impl-review`.

---

## Testing Strategy

### Unit Tests:

- None required beyond type-level guarantees; the Zod schema's optional-field coercion is
  exercised through the actions in E2E. (S-01 added no Vitest specs either; match that.)

### Integration / E2E Tests:

- Full CRUD on a note's topic checks through the UI (Phase 4).
- Shiki highlight assertion on `code_context`.
- Two-account RLS isolation on the new write/read path.

### Manual Testing Steps:

1. Create a note, scroll to "Topic checks", confirm empty state.
2. Add a check: question + example + a `ts fenced block` → save → it lists, code highlighted.
3. Edit it → form seeds with current values, only one editor mounted → save → row updates.
4. Delete it → AlertDialog → confirm → row gone.
5. Add a check with both optionals blank → persists, renders without empty boxes.
6. Resize to ~360px → section stays usable.

## Performance Considerations

A note's topic-check count is small (personal tool, `target_scale: small`) — no pagination
needed. Exactly one CodeMirror island is mounted regardless of check count (the toggled-form
decision). Shiki runs server-side only, so no highlight JS ships per check.

## Migration Notes

Additive, nullable columns only — no backfill, no data migration. Existing rows (test notes in
the local DB) get `null` for both new columns. The new migration must timestamp after
`20260603092554`.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-02)
- PRD: `context/foundation/prd.md` (FR-012–015, US-01)
- Schema: `supabase/migrations/20260603070945_init_notes_topic_checks_review_events.sql`
- Write pattern to mirror: `src/features/notes/run-note-action.ts`, `actions/create-note.ts`
- Read pattern: `src/features/notes/queries.ts`, `src/features/topic-checks/queries.ts`
- UI patterns: `src/features/notes/{note-form,note-editor,delete-note-button}.tsx`
- Lessons: `context/foundation/lessons.md` (Playwright signInWithPassword; pg_catalog for constraints)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema + typegen

#### Automated

- [x] 1.1 Migration applies cleanly on a reset local stack (`supabase db reset`) — 65574aa
- [x] 1.2 New columns exist and are nullable (`\d topic_checks` via pg_catalog) — 65574aa
- [x] 1.3 Type checking passes (`pnpm typecheck`) — 65574aa
- [x] 1.4 Generated `types.ts` includes `example` + `code_context` in the topic_checks types — 65574aa

#### Manual

- [ ] 1.5 Manual insert with both columns null and both populated both succeed

### Phase 2: Write + read layer

#### Automated

- [x] 2.1 Type checking passes (`pnpm typecheck`) — c125a02
- [x] 2.2 Linting passes (`pnpm lint`) — c125a02
- [x] 2.3 Build passes (`pnpm build`) — c125a02

#### Manual

- [ ] 2.4 Notes CRUD still works after the runNoteAction → runTableAction promotion (no regression)

### Phase 3: Inline UI on note detail

#### Automated

- [x] 3.1 Type checking passes (`pnpm typecheck`) — 424528b
- [x] 3.2 Linting passes (`pnpm lint`) — 424528b
- [x] 3.3 Production build passes (`pnpm build`) — 424528b

#### Manual

- [ ] 3.4 Empty state shows, then a check lists after adding
- [ ] 3.5 code_context with a fenced block renders syntax-highlighted
- [ ] 3.6 Edit swaps the single form into edit mode (one editor), saves, row updates
- [ ] 3.7 Delete shows AlertDialog, confirms, row disappears
- [ ] 3.8 Blank optionals persist as null and render cleanly
- [ ] 3.9 Layout usable down to ~360px

### Phase 4: E2E

#### Automated

- [x] 4.1 E2E suite passes (`pnpm test:e2e`) — 9c76c78
- [x] 4.2 Isolation assertion negative-control verified, then passes — 9c76c78

#### Manual

- [ ] 4.3 CRUD spec exercises the user flow with no console errors
