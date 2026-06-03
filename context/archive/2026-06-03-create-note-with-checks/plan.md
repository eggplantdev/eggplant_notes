# Create a Note with Topic Checks Inline (S-07) — Implementation Plan

## Overview

Let the user attach 0..N topic checks **in the same flow** as creating a note on `/notes/new`,
saved together atomically. Today the only way to add a check is: create note → redirect to
detail → add checks one at a time. This slice stages checks client-side in the create form and
persists the note + all its checks in **one transaction** via a new `SECURITY INVOKER` Postgres
RPC, then redirects to the new note's detail page.

## Current State Analysis

- `createNote` (`src/features/notes/actions/create-note.ts:16-28`) inserts `{ title, content,
subject_id, position }` via `runTableAction`, then `revalidatePath('/notes')` +
  `redirect('/notes/${id}')`. It is the **only** consumer of `createNote` (the `/notes/new` route);
  the edit route uses `updateNote`.
- `createTopicCheck` (`src/features/topic-checks/actions/create-topic-check.ts:15-30`) inserts
  `{ note_id, prompt, example, code_context }` — never `user_id`, never FSRS columns. Requires a
  pre-existing `note_id`.
- `topic_checks.note_id` is `NOT NULL` FK → `notes(id)` ON DELETE CASCADE
  (`supabase/migrations/20260603070945_…:48`). A check cannot exist before its note row.
- `runTableAction` (`src/lib/supabase/run-table-action.ts:19-34`) is **single-table, single-row**
  (ends `.select().single()`). It cannot express a note-then-checks multi-table write.
- The atomic-multi-write precedent is `record_review`
  (`supabase/migrations/20260603131542_fsrs_review_loop.sql:48-83`): `language plpgsql`,
  `security invoker`, `set search_path = ''`, one transaction, RLS scopes both writes, grants
  revoked from `public, anon` and granted to `authenticated`. Its TS call site
  (`src/features/review/actions/rate-topic-check.ts:17-57`) documents why it bypasses
  `runTableAction` and hand-rolls the `{success}`/error envelope.
- Typed `.rpc()` requires the `public.Functions` block in `src/lib/supabase/types.ts:206-212` — a
  new RPC won't type-check until `types.ts` is regenerated.
- `NoteForm` (`src/features/notes/note-form.tsx`) is a `useAppForm` island with a discriminated
  props union (create vs edit off `note` truthiness); title validated `onBlur`+`onSubmit`
  (`titleSchema`). Shared markdown primitives live in `src/components/markdown/`.

Full grounding: `context/changes/create-note-with-checks/research.md`.

## Desired End State

On `/notes/new` the user fills title + content (as today) and can **add one or more topic-check
rows inline** (question + optional example + optional code context), each removable. Saving once
writes the note and all rows atomically; the user lands on `/notes/${newId}` with every staged
check already attached. With zero rows added, the page behaves exactly like today's plain note
create. A mid-save failure leaves **neither** a note nor partial checks (all-or-nothing).

Verify: create a note with 2 checks → redirected to detail showing both; add a row with an empty
question → save is blocked with a field error; create with no checks → note saved, no checks.

### Key Discoveries:

- `create_note_with_checks` RPC = the new atomic writer; mirrors `record_review` exactly
  (`fsrs_review_loop.sql:48-83`).
- The RPC is a **dumb writer** — `position` is computed in the Server Action (as `createNote`
  does today) and passed in `p_note`; the RPC inserts only the allowed columns explicitly (never
  mass-assigns `user_id`).
- The new Server Action **replaces** `createNote`'s body (chosen path: RPC always, even for 0
  checks) — one create path, no client/server branching.
- `redirect()` throws, so the create form only observes the failure branch; `ActionResultT` needs
  **no** success payload (the RPC's returned id is used server-side for the redirect).

## What We're NOT Doing

- **Not** touching the edit flow (`/notes/[id]/edit`) or the detail-page `TopicChecksSection` —
  S-07 is "while **creating** a note". Edit keeps today's inline section (S-02).
- **Not** adding inline check **editing/reordering** during staging beyond add/remove + field
  entry (no per-row edit modes, no drag reorder).
- **Not** widening `ActionResultT` or changing the topic-check or note schemas.
- **Not** removing the now-unused `createNote` insert path in this change — flag it for the review
  gate to decide (avoid scope creep / risky edits to a working export).
- **Not** writing FSRS/`user_id` columns — DB defaults + RLS own those.

## Implementation Approach

Bottom-up: land the atomic write path (migration + RPC + typegen) first so the Server Action
compiles against the generated `Functions` type; then the hand-rolled Server Action; then the
client staging UI; then E2E (after the review→simplify gate, per CLAUDE.md). The RPC keeps the
`record_review` division of labor — TS validates + computes `position`, SQL just persists in one
transaction with RLS enforcing ownership.

## Critical Implementation Details

- **Migration ordering**: the new migration timestamp must sort **after** the current latest,
  `20260603151508_add_subjects_and_note_ordering.sql` (S-06). Generate via
  `supabase migration new create_note_with_checks_rpc` (auto-timestamps to now, so ordering is
  correct).
- **Mass-assignment guard**: the RPC must insert note columns **explicitly** (`title`, `content`,
  `subject_id`, `position`) from `p_note->>'…'`, never `jsonb_populate_record(notes, p_note)` —
  otherwise a caller could set `user_id` and defeat the `default auth.uid()` + RLS guard. Same for
  checks: select only `prompt`, `example`, `code_context` from each array element.
- **Typegen in the same phase**: regenerate `src/lib/supabase/types.ts` in Phase 1 or Phase 2
  won't compile (`.rpc('create_note_with_checks', …)` is untyped until the `Functions` entry exists).
- **`db reset` double-insert trap** (AGENTS.md): applying the new migration requires
  `supabase db reset`, which re-runs `seed.sql`. Expected; just don't re-apply the seed standalone.

---

## Phase 1: Migration + RPC + Typegen

### Overview

Add the atomic `create_note_with_checks` RPC and regenerate the typed `Database` so `.rpc()` is
type-checked.

### Changes Required:

#### 1. New migration — the RPC

**File**: `supabase/migrations/<new-timestamp>_create_note_with_checks_rpc.sql`

**Intent**: Create one transaction that inserts a note, captures its id, inserts each staged
check against that id, and returns the new note id — RLS scoping every write to `auth.uid()`.

**Contract**: `create function public.create_note_with_checks(p_note jsonb, p_checks jsonb)
returns uuid language plpgsql security invoker set search_path = ''`. Insert into
`public.notes (title, content, subject_id, position)` reading explicit keys from `p_note`
(never `user_id`), `returning id into v_note_id`. Then
`insert into public.topic_checks (note_id, prompt, example, code_context)
select v_note_id, c->>'prompt', nullif(trim(c->>'example'),''), nullif(c->>'code_context','')
from jsonb_array_elements(coalesce(p_checks,'[]'::jsonb)) as c`. `return v_note_id`. Close with
`revoke execute on function public.create_note_with_checks(jsonb, jsonb) from public, anon;`
`grant execute … to authenticated;`. Mirror `record_review` (`fsrs_review_loop.sql:48-83`).

> RLS under `SECURITY INVOKER`: S-06 tightened `notes_insert_own` to require `subject_id` to be a
> subject the caller owns (`20260603151508:60-71`). Because the RPC runs as the invoker, that
> `with check` applies to the RPC's note insert too — a forged/foreign `subject_id` is rejected by
> RLS (and the whole transaction aborts), which is the intended behavior. No extra app-side check needed.

> Note on NULL coercion: the Server Action already runs `topicCheckInputSchema` (whose
> `optionalText` maps blanks → `null`), so `p_checks` arrives clean. The `nullif` in SQL is a
> defense-in-depth belt; keep it minimal — do **not** re-trim `code_context` (preserve indentation),
> matching the schema's untrimmed treatment.

#### 2. Regenerate typed Database

**File**: `src/lib/supabase/types.ts`

**Intent**: Add the `create_note_with_checks` entry to `public.Functions` so the typed client
accepts the `.rpc()` call.

**Contract**: `Functions.create_note_with_checks: { Args: { p_note: Json; p_checks: Json };
Returns: string }`. Generate via `pnpm db:types` (`package.json:19` →
`supabase gen types typescript --local > src/lib/supabase/types.ts`), not by hand-editing, then
verify the entry is present. (Void RPCs render as `Returns: undefined`; this one returns `uuid` →
`Returns: string`.)

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `supabase db reset` succeeds
- RPC exists with `SECURITY INVOKER` + correct grants (verify via `pg_proc`/`pg_catalog`, not
  `information_schema` — per `lessons.md`)
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- Calling the RPC from the Supabase SQL editor as an authenticated role inserts a note + checks
  scoped to that user; calling with a forged/foreign `subject_id` is rejected by RLS

---

## Phase 2: Server Action (RPC always)

### Overview

Replace `createNote`'s write with a call to the new RPC, validating note + checks and redirecting
to the new note on success.

### Changes Required:

#### 1. Combined input schema

**File**: `src/features/notes/schemas.ts`

**Intent**: Add a schema for the create-with-checks payload so one `validateInput` covers the
whole submission.

**Contract**: `createNoteWithChecksSchema = z.object({ note: noteInputSchema, checks:
z.array(topicCheckInputSchema) })` (import `topicCheckInputSchema` from the topic-checks feature).
Export its inferred type. Reuse existing `noteInputSchema`; do not redefine fields.

#### 2. Repurpose `createNote`

**File**: `src/features/notes/actions/create-note.ts`

**Intent**: Validate the combined payload, compute `position` exactly as today, call the RPC, and
keep the existing PRG contract (revalidate + redirect to the new note).

**Contract**: `createNote(input: unknown): Promise<ActionResultT>`. Hand-rolled (not
`runTableAction` — multi-table write + RPC return; mirror `rate-topic-check.ts:17-57`):
`validateInput(createNoteWithChecksSchema, input)` → build `p_note = { ...note, position:
note.subject_id ? Date.now() : null }` → `supabase.rpc('create_note_with_checks', { p_note,
p_checks: checks })`. On `error` → `console.error(...)` + `return { success: false, error:
error.message }`. On success → `revalidatePath('/notes')` + `redirect('/notes/${data}')` (`data`
is the returned uuid). No success payload returned (redirect throws).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- POST from a temporary harness / the existing form (pre-UI) with 0 checks creates a note and
  redirects; with N checks creates note + N checks; an RPC error surfaces inline rather than 500ing

---

## Phase 3: Inline Staging UI

### Overview

Add removable check rows to the create form and submit the combined `{ note, checks }` payload.

### Changes Required:

#### 1. Staged-checks UI in the create form

**File**: `src/features/notes/note-form.tsx` (+ a co-located row sub-component if it keeps the file
cohesive, e.g. `src/features/notes/staged-check-row.tsx`)

**Intent**: In **create mode only** (`note` absent), render a list of staged check rows with an
"Add check" control and per-row remove; each row captures `prompt` (required), `example`
(optional), `code_context` (optional). On submit, gather note fields + staged rows into the
combined payload and call the repurposed `createNote`.

**Contract**: Staged checks held in client array state keyed by a temp id (stripped before
submit). Each row's `prompt` validated `onBlur`+`onSubmit` against `promptSchema` (no eager error
while typing — consistent with the title rule); **save is blocked while any row is invalid**.
`example` → plain `Textarea`; `code_context` → the shared lazy `MarkdownEditor`
(`src/components/markdown/markdown-editor.tsx`, `ssr:false` CodeMirror) — same field shape as
`TopicCheckForm`. Reuse the shared markdown primitives; do not fork them. The edit branch
(`note` present) is unchanged. Empty staged list → `checks: []`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Production build passes: `pnpm build`

#### Manual Verification:

- Add 2 check rows, fill them, save → land on the new note's detail page with both checks shown
- Remove a row before saving → it is not persisted
- Leave a row's question empty → inline error, save blocked
- Save with zero rows → plain note created, detail page shows no checks
- code_context highlighting/preview works in a staged row; multiple rows mount independently

---

## Phase 4: E2E (authored after the review→simplify gate)

### Overview

Playwright coverage for the inline create-with-checks flow, atomicity, and the zero-checks path.
Per CLAUDE.md the test layer is written **after** the review fan-out + `/simplify`, so the specs
lock in the cleaned-up code.

### Changes Required:

#### 1. New spec

**File**: `e2e/create-note-with-checks.spec.ts`

**Intent**: Cover the slice's user-visible contract end-to-end against a fresh server.

**Contract**: Reuse `e2e/helpers.ts` (`signUp`, `uniqueEmail`, `fillEditor`, `clientFor`). Cases:
(1) create a note with 2 inline checks → detail page shows both questions; (2) zero checks →
note created, detail shows no checks; (3) a row with an empty question blocks save (button
disabled or visible error, no redirect). Optionally assert rows landed via an injectable
`clientFor` supabase-js client authenticated with `signInWithPassword` (per `lessons.md` —
not cookie reuse), confirming RLS-scoped persistence. Keep per-test `uniqueEmail` sign-ups
(don't gate on the known GoTrue sign-up flake; `retries` cover it).

### Success Criteria:

#### Automated Verification:

- E2E passes: `pnpm test:e2e` (local Supabase stack up; fresh build server per AGENTS.md)
- Full suite green: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build`

#### Manual Verification:

- The new spec fails if the RPC is made non-atomic (negative control: temporarily break the
  check insert and confirm no orphan note is left / the test catches it)

---

## Testing Strategy

### Unit Tests:

- None required — the logic is a thin Server Action + a SQL RPC; correctness is covered by E2E and
  the RPC's transactional behavior. (No pure function worth isolating, unlike S-04's `streak.ts`.)

### Integration / E2E Tests:

- The Phase 4 spec is the integration surface: full create-with-checks flow, atomicity, zero-checks.

### Manual Testing Steps:

1. `/notes/new` → add 2 checks, fill question + code on one → Save → land on detail with both.
2. Add a check, clear its question → Save is blocked with an inline error.
3. Create with no checks → behaves like today.
4. Confirm a second account cannot see the first's note/checks (RLS unchanged, but sanity-check).

## Performance Considerations

N lazy CodeMirror islands (one per staged row's `code_context`) mount on demand; authoring volume
is low (a handful of checks), so this is acceptable. No server-side hotspot — the RPC is one
round-trip replacing what would otherwise be N+1 PostgREST calls.

## Migration Notes

Additive: one new RPC, no table/column changes, no data backfill (PRD v2: no real data yet).
Applying it locally needs `supabase db reset` (re-runs `seed.sql` — expected).

## References

- Research: `context/changes/create-note-with-checks/research.md`
- Atomic-RPC precedent: `supabase/migrations/20260603131542_fsrs_review_loop.sql:48-83`
- Hand-rolled RPC action: `src/features/review/actions/rate-topic-check.ts:17-57`
- PRG exemplar: `src/features/notes/actions/create-note.ts:16-28`
- Topic-check write + schema: `src/features/topic-checks/actions/create-topic-check.ts:15-30`,
  `src/features/topic-checks/schemas.ts:8-26`
- Form host: `src/features/notes/note-form.tsx`; shared markdown: `src/components/markdown/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migration + RPC + Typegen

#### Automated

- [x] 1.1 Migration applies cleanly (`supabase db reset` succeeds) — d35b9f5
- [x] 1.2 RPC exists with SECURITY INVOKER + correct grants (verify via pg_catalog) — d35b9f5
- [x] 1.3 Type checking passes (`pnpm typecheck`) — d35b9f5
- [x] 1.4 Linting passes (`pnpm lint`) — d35b9f5

#### Manual

- [x] 1.5 RPC inserts note + checks scoped to caller; forged subject_id rejected by RLS — d35b9f5

### Phase 2: Server Action (RPC always)

#### Automated

- [x] 2.1 Type checking passes (`pnpm typecheck`) — 20b6c01
- [x] 2.2 Linting passes (`pnpm lint`) — 20b6c01

#### Manual

- [x] 2.3 0-check and N-check creates redirect correctly; RPC error surfaces inline — a6fa262

### Phase 3: Inline Staging UI

#### Automated

- [x] 3.1 Type checking passes (`pnpm typecheck`) — 3bf27a8
- [x] 3.2 Linting passes (`pnpm lint`) — 3bf27a8
- [x] 3.3 Production build passes (`pnpm build`) — 3bf27a8

#### Manual

- [x] 3.4 Add/fill 2 rows → detail shows both checks — a6fa262
- [x] 3.5 Remove a row → not persisted — a6fa262
- [x] 3.6 Empty question → inline error, save blocked — a6fa262
- [x] 3.7 Zero rows → plain note created — a6fa262
- [x] 3.8 code_context highlight/preview works per row — a6fa262 (reuses MarkdownEditor/MarkdownPreview verified in notes.spec.ts; not directly E2E-driven per row — multi-editor locator)

### Phase 4: E2E (after review→simplify gate)

#### Automated

- [x] 4.1 New spec passes (`pnpm test:e2e`) — a6fa262
- [x] 4.2 Full suite green (typecheck, lint, test, test:e2e, build) — a6fa262 (typecheck/lint/test/build green; new spec 3/3 green in isolation; full-run sign-up failures were the documented GoTrue flake — lessons.md, not gated)

#### Manual

- [x] 4.3 Negative control: non-atomic RPC leaves no orphan / test catches it — a6fa262 (verified in Phase 1: forced check-insert/forged-subject failure aborted the txn, 0 orphan notes)
