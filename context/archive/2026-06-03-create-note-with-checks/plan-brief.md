# Create a Note with Topic Checks Inline (S-07) — Plan Brief

> Full plan: `context/changes/create-note-with-checks/plan.md`
> Research: `context/changes/create-note-with-checks/research.md`

## What & Why

Let the user attach one or more topic checks **while creating a note**, saved together — instead
of today's "create note → redirect to detail → then add checks". Smoother daily authoring; a
fast-follow UX win, not on the critical path.

## Starting Point

`/notes/new` renders `NoteForm` → `createNote` inserts a note and redirects to its detail page,
where checks are added one at a time. `topic_checks.note_id` is a `NOT NULL` FK, so a check
cannot exist before its note — the reason this isn't trivial.

## Desired End State

On `/notes/new` the user fills title + content and can add removable check rows (question +
optional example + optional code context). One Save writes the note and all checks **atomically**,
then lands on `/notes/${newId}` with every check attached. Zero rows = today's plain create. A
mid-save failure leaves neither note nor partial checks.

## Key Decisions Made

| Decision    | Choice                                                        | Why (1 sentence)                                                                              | Source      |
| ----------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------- |
| Atomicity   | New `SECURITY INVOKER` RPC `create_note_with_checks`          | Note + checks in one transaction; mirrors the proven `record_review` pattern, RLS scopes both | Plan (user) |
| Action path | RPC always — replace `createNote`'s write                     | One create path, no client/server branch, even for 0 checks                                   | Plan (user) |
| Staging UI  | prompt input + example textarea + lazy code_context editor    | Field parity with the detail-page `TopicCheckForm`; reuse shared markdown primitives          | Plan (user) |
| Validation  | Per-row deferred (`onBlur`+`onSubmit`), block save on invalid | Matches the title-validation convention; no half-saved data under an atomic write             | Plan (user) |
| Scope       | `/notes/new` only                                             | S-07 is "while creating"; edit keeps its working inline section                               | Plan (user) |
| PRG         | `revalidatePath('/notes')` + `redirect('/notes/[id]')`        | The established `create-note.ts` contract; refresh re-GETs, no dup submit                     | Research    |
| Position    | Computed in TS, passed in `p_note`                            | Keeps the RPC a dumb writer (the `record_review` division of labor)                           | Research    |

## Scope

**In scope:** new RPC + migration + typegen; repurposed `createNote` Server Action; inline staging
UI on the create form; E2E.

**Out of scope:** edit flow / detail-page section; per-row edit modes or reorder; schema or
`ActionResultT` changes; removing the now-unused `createNote` insert path (flag for review gate).

## Architecture / Approach

TS validates `{ note, checks[] }` (reusing `noteInputSchema` + `topicCheckInputSchema`), computes
`position`, and calls one RPC. The RPC inserts the note explicitly (never mass-assigning
`user_id`), captures the id, inserts each check with that `note_id`, and returns the id — one
transaction, RLS-enforced. The form holds staged checks in client array state and submits the
combined payload; on success the action redirects to the new note.

## Phases at a Glance

| Phase                        | What it delivers                                       | Key risk                                                                              |
| ---------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 1. Migration + RPC + typegen | Atomic `create_note_with_checks` + typed `.rpc()`      | Mass-assignment via jsonb (mitigated: explicit columns); typegen must land same phase |
| 2. Server Action             | `createNote` calls the RPC, keeps PRG                  | Hand-rolled envelope (no `runTableAction`) — mirror `rate-topic-check.ts`             |
| 3. Inline staging UI         | Add/remove check rows on the create form               | New UI; N lazy editors; per-row deferred validation                                   |
| 4. E2E (after gate)          | Playwright: create-with-checks, atomicity, zero-checks | GoTrue sign-up flake (covered by retries)                                             |

**Prerequisites:** S-01 + S-02 shipped (both done); local Supabase stack for migration + E2E.
**Estimated effort:** ~1 session across 4 phases.

## Open Risks & Assumptions

- The jsonb RPC must insert columns **explicitly** — a `jsonb_populate_record` shortcut would let
  a caller set `user_id` and defeat RLS. Called out as the #1 implementation guard.
- `createNote` becomes unused on the create route; left in place this change, flagged for the
  review gate to decide removal (deletion-test / dead-code).

## Success Criteria (Summary)

- Create a note with N checks in one flow → all attached on the detail page.
- A bad row blocks the save; a failed save leaves no orphan note (atomic).
- Zero-checks create is unchanged.
