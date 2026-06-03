---
date: 2026-06-03T17:47:58+0000
researcher: ex-Plant
git_commit: f2cbd64b4135be37e36e5de582cec35129b42551
branch: main
repository: 10x_devs
topic: 'S-07 — create a note with topic checks inline (write paths, atomicity, PRG)'
tags: [research, codebase, notes, topic-checks, server-actions, rpc, prg]
status: complete
last_updated: 2026-06-03
last_updated_by: ex-Plant
---

# Research: S-07 — create a note with topic checks inline

**Date**: 2026-06-03T17:47:58+0000
**Researcher**: ex-Plant
**Git Commit**: f2cbd64b4135be37e36e5de582cec35129b42551
**Branch**: main
**Repository**: 10x_devs

## Research Question

Ground a plan for slice S-07 "create a note with checks inline": let the user attach one or
more topic checks in the **same flow** as creating a note, instead of today's "create note →
redirect to detail → then add checks". Specifically: how the note-create write+UI path works,
how topic-check writes work, the atomicity precedent (sequential vs all-or-nothing RPC), and
how Post/Redirect/Get is handled.

## Summary

- **The two-ordered-writes problem is real and already solved elsewhere.** `topic_checks.note_id`
  is `NOT NULL` FK → `notes(id)`, so a check cannot exist before its note. The note must be
  inserted first to obtain `id`, then checks inserted with that `note_id`.
- **`createNote` already has the new id in scope** (`.insert(...).select('id').single()` →
  `result.data.id`) before it redirects — so a single Server Action can insert the note, capture
  the id, then write the checks, all before the final `redirect`.
- **Atomicity precedent is `record_review`** — a `SECURITY INVOKER`, `set search_path = ''`,
  `language plpgsql` RPC doing two ordered writes in one transaction with RLS scoping both. S-07's
  "note then N checks under a not-null FK" maps onto this almost exactly. `delete_account`'s
  `SECURITY DEFINER` is **not** the model (S-07 only writes the user's own `public` tables).
- **`runTableAction` cannot express this** — it is single-schema → single PostgREST write →
  `.select().single()`. A multi-row / multi-table write must either be a hand-rolled Server Action
  (like `rate-topic-check.ts`) calling an RPC, or sequential `runTableAction` calls (best-effort).
- **PRG: S-07 matches `create-note.ts`, not `create-topic-check.ts`** — it ends a note-create flow,
  so the natural finish is `revalidatePath` + `redirect('/notes/[newId]')`. `redirect()` throws to
  unwind, so refresh re-GETs (the only duplicate-submit defense in the repo; no idempotency tokens).
- **Staging UI is a deliberate departure**: the detail-page inline form is URL-driven (`?edit`),
  but staging _new_ checks before the note exists has no id/URL — it must hold staged checks in
  **client state** (a `useState` array in the `NoteForm` island) with add/remove, then one submit.

## Detailed Findings

### Note-create write path

- `src/features/notes/actions/create-note.ts:16-28` — `createNote(input: unknown): Promise<ActionResultT>`.
  Inserts `{ ...data, position: data.subject_id ? Date.now() : null }` where `data` =
  `noteInputSchema` output = `{ title, content, subject_id }`. **Never sends `user_id`** (DB
  `default auth.uid()` + RLS `with check`). Ends `.select('id').single()`; then
  `revalidatePath('/notes')` + `redirect('/notes/${result.data.id}')`. **This redirect is the
  "redirect-first" behavior S-07 eliminates.** (CLAUDE.md's "only `{title,content}`" note is stale —
  S-06 added `subject_id`+`position`; the `user_id`-never-sent half still holds.)
- `src/lib/supabase/run-table-action.ts:19-34` — `runTableAction(schema, input, call)`: validates
  via `validateInput`, builds the per-request server client, runs one write, normalizes `{data,error}`
  to `TableActionResultT<TRow>`; **returns** errors (does not throw); write must end `.select().single()`.
  Not a `'use server'` file. **Single-table, single-row only.**
- `src/types/action.ts:2` — `ActionResultT = {success:true} | {success:false; error}`. **Carries no
  payload on success.** If the client needs the new note id after the action, this must be widened —
  or the whole flow kept server-side in one action/RPC (preferred).

### Note-create UI

- Route: `src/app/(protected)/notes/new/page.tsx` — async RSC, fetches `getSubjects()`, renders
  `<NoteForm action={createNote} subjects={subjects} />`. Edit route reuses with `action={updateNote} note={note}`.
- `src/features/notes/note-form.tsx` (`'use client'`) — discriminated props union (create vs edit off
  `note` truthiness); `useAppForm` (`src/components/forms/hooks/form-hooks.ts:8`); `defaultValues:
{title, content, subject_id}`; `onSubmit` calls action, sets `formError` on `!result.success`.
  Title validated `onBlur`+`onSubmit` (`titleSchema`) — no error while typing. Errors via `FormError`.
- Editor/preview primitives are shared in `src/components/markdown/`: `MarkdownEditor` (lazy
  `ssr:false` CodeMirror island), `MarkdownPreview` (debounced `useDeferredValue`+`useMemo`, no Shiki),
  `RenderMarkdown` (server-only Shiki for the saved view). Reuse — don't fork. CodeMirror is a
  controlled input, **not registered into the form hook** (manual value/onChange). Multiple islands
  per page are fine.

### Topic-check write path

- `src/features/topic-checks/actions/create-topic-check.ts:15-30` — `createTopicCheck(noteId, input)`:
  validates `noteId` separately via `noteIdSchema` (`z.uuid`), inserts `{ note_id, ...data }` via
  `runTableAction(topicCheckInputSchema, ...)`. **Columns written: exactly `note_id`, `prompt`,
  `example`, `code_context`.** Never `user_id`, never FSRS columns (the schema physically excludes
  them from `...data`). Ends `revalidatePath('/notes/${noteId}')` + `return {success:true}` — **no
  redirect** (stays on detail page; island resets).
- `src/features/topic-checks/schemas.ts:8-26` — `topicCheckInputSchema = { prompt: promptSchema
(required, trim, 1–2000), example: optionalText, code_context: optionalText }`. `optionalText` =
  `z.string().transform(blank → null)` — so blank optional fields persist as SQL NULL automatically;
  non-empty keep original (untrimmed) text. `noteIdSchema = z.uuid`.
- Inline UI: `src/features/topic-checks/topic-checks-section.tsx` (server) resolves `?edit` →
  `editingCheck`, stale-`?edit` redirects to bare `/notes/[id]`, renders the list + a single
  `<TopicCheckForm key={editId ?? 'new'} ...>` (remount-on-edit, no client `editingId`).
  `topic-check-form.tsx` distinguishes create/edit by `check` presence; one CodeMirror island
  (`code_context`).

### DB schema (`topic_checks`)

- `supabase/migrations/20260603070945_init_notes_topic_checks_review_events.sql:46-80` — `note_id
uuid not null references notes(id) on delete cascade` (no default → must be supplied); `user_id
... default auth.uid()`; `prompt text not null`. Per-action RLS: `*_own` policies all
  `with check / using ((select auth.uid()) = user_id)`. Indexes incl. `topic_checks_note_id_idx`.
- `20260603104838_add_topic_check_content_columns.sql` — `example`, `code_context`: nullable, no default.
- `20260603131542_fsrs_review_loop.sql:13-25` — dropped SM-2 cols; added FSRS state cols (all
  `not null` default, except nullable `last_review`). Never written by the create path.

### Atomicity precedent (the decision input)

- `record_review` RPC — `20260603131542_fsrs_review_loop.sql:48-83`: `language plpgsql`,
  `security invoker`, `set search_path = ''`, `public.`-qualified; one function body = one
  transaction (UPDATE topic_checks + INSERT review_events, all-or-nothing); UPDATE-first +
  `if not found then raise` aborts before the dependent write; `revoke execute from public, anon` +
  `grant execute to authenticated`. **This is the all-or-nothing template for S-07.**
- `delete_account()` RPC — `20260603092554_add_delete_account_rpc.sql:22-32`: `security definer`
  **only** because `authenticated` lacks delete on `auth.users`; RLS does NOT protect a definer fn —
  the `where id = auth.uid()` predicate is its whole security model. **Not the S-07 model.**
- Typed `.rpc()`: `src/lib/supabase/types.ts:206-212` (`Functions` block) + `createServerClient<Database>`
  (`server.ts:11`). **A new RPC won't type-check until `types.ts` is regenerated** — regen must be in
  the same phase as the migration.
- `src/features/review/actions/rate-topic-check.ts:17-57` — the call-site model: documents _why_ it
  does NOT use `runTableAction` (multi-input, intermediate compute, void RPC) and hand-rolls the
  `{success}`/error envelope. S-07 hits the same fork if it uses an RPC.

### PRG / duplicate-submit

- `redirect()` throws → action observes only the failure branch; refresh re-GETs the redirect target.
  **This + `revalidatePath` is the only duplicate-submit defense in the repo — no idempotency tokens.**
- Redirecting creates: `create-note.ts:26-27`, `create-subject.ts:19-20`. Non-redirecting
  sub-resource writes: `create-topic-check.ts:28`, `rate-topic-check.ts:54-55`. S-07 ends a
  note-create flow → matches the redirecting pattern.

## Code References

- `src/features/notes/actions/create-note.ts:16-28` — note insert + PRG redirect (the behavior to change)
- `src/features/topic-checks/actions/create-topic-check.ts:15-30` — child insert with `note_id`, no redirect
- `src/features/topic-checks/schemas.ts:8-26` — `topicCheckInputSchema`, `optionalText`, `noteIdSchema`
- `src/lib/supabase/run-table-action.ts:19-34` — single-table write wrapper (cannot do multi-row)
- `src/types/action.ts:2` — `ActionResultT` (no success payload)
- `src/features/notes/note-form.tsx` — `useAppForm` create/edit island (the host for staged checks)
- `src/components/markdown/` — shared editor/preview/render primitives
- `supabase/migrations/20260603131542_fsrs_review_loop.sql:48-83` — `record_review` RPC (atomic template)
- `supabase/migrations/20260603070945_init_notes_topic_checks_review_events.sql:46-80` — `topic_checks` DDL + RLS
- `src/lib/supabase/types.ts:206-212` — `Functions` typed RPC block (regenerate after new RPC)
- `src/features/review/actions/rate-topic-check.ts:17-57` — hand-rolled RPC Server Action exemplar

## Architecture Insights

- **Promotion already happened**: `runTableAction` is the shared single-table writer (promoted on
  its 2nd consumer per AGENTS.md). A multi-write RPC action is the established escape hatch when the
  wrapper doesn't fit (`rate-topic-check.ts`).
- **Server never trusts the client for ownership**: `user_id` is always the DB default `auth.uid()` +
  RLS, never sent. Staged checks must keep to `{prompt, example, code_context}` (+ a client-only temp
  key stripped before submit).
- **Three viable atomicity shapes** for the plan to choose between:
  1. **Atomic RPC** (`create_note_with_checks`, `SECURITY INVOKER`) — note + checks in one
     transaction; mirrors `record_review`; strongest integrity; costs a migration + typegen + a
     hand-rolled action.
  2. **Sequential in one Server Action** — `createNote` insert → loop `insert` checks with the new id;
     best-effort; a mid-sequence failure leaves a note with _some/zero_ checks (no orphan, FK holds).
  3. **Single batched array insert** — `.insert([{note_id,...c1}, ...])` after the note; one PostgREST
     call for all checks (not all-or-nothing with the note, but the checks succeed/fail together).
- **The staging UI is the genuinely new UI work** — a client array in `NoteForm` with add/remove rows,
  each row reusing the topic-check field shape; departs from the URL-driven detail-page form.

## Historical Context (from prior changes)

- `context/archive/2026-06-03-capture-note-with-code/plan.md` — established the note-create PRG
  contract (`.select().single()` → `revalidatePath` → `redirect('/notes/[id]')`; failure returns inline).
- `context/archive/2026-06-03-attach-topic-checks/plan.md` — promoted `runNoteAction` →
  `run-table-action.ts` (single-table); topic-check writes are independent single-row, no redirect.
- `context/archive/2026-06-03-close-recall-loop/plan.md` — the atomic-multi-write precedent:
  `record_review` as a "dumb atomic writer", `SECURITY INVOKER`, order-matters guard, bypass
  `runTableAction`.
- `context/archive/2026-06-03-delete-account-and-data/plan.md` — `SECURITY DEFINER` rationale +
  the hosted-privilege caveat (applies ONLY to definer fns touching `auth.*`; an INVOKER S-07 RPC
  sidesteps it).

## Related Research

- None prior for this change. Adjacent: the archived plans above.

## Open Questions (for `/10x-plan` to resolve)

- **Atomicity decision**: atomic RPC (shape 1) vs sequential-in-one-action (shape 2) vs batched array
  insert (shape 3). Research recommends shape 1 (precedent + integrity) but it carries a migration;
  shape 3 is a lighter middle ground (checks atomic among themselves, note separate). `main_goal: speed`
  weighs against a migration if shape 3 is "good enough" for a fast-follow slice.
- **PRG target**: redirect to `/notes/[newId]` after save (matches `create-note.ts`). Confirm.
- **Empty-checks case**: zero staged checks must behave exactly like today's plain note create.
- **Validation surfacing for staged rows**: reuse `topicCheckInputSchema` per row; defer eager errors
  (consistent with the title `onBlur`+`onSubmit` rule).
