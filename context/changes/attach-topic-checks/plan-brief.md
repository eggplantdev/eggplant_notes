# Attach Topic Checks (S-02) — Plan Brief

> Full plan: `context/changes/attach-topic-checks/plan.md`

## What & Why

Topic checks are the unit the recall loop schedules — without them there's nothing to review.
This slice lets a user attach a recall prompt (question + optional example + optional
code-block context) to a note, edit it, delete it, and see all checks on that note (FR-012–015).
It's the direct prerequisite for S-03 (the north-star recall loop).

## Starting Point

The `topic_checks` table already exists from F-02 — with `note_id`/`user_id` FKs, RLS per-user
policies, and SM-2 scheduling columns that stay unwritten until S-03. S-01 shipped the full
notes vertical (Server Actions + CodeMirror editor + Shiki render + AlertDialog delete) that
this slice mirrors one tier down. Today a note detail page renders the note body but has no
topic-check UI.

## Desired End State

On `/notes/[id]`, a "Topic checks" section lists every check on the note (code rendered with
Shiki highlighting), with an inline CodeMirror-backed form to add/edit (one editor mounted at a
time) and an AlertDialog-confirmed delete. Every operation is RLS-scoped — a user only sees and
mutates their own checks — proven by a Playwright spec.

## Key Decisions Made

| Decision             | Choice                                            | Why (1 sentence)                                                                              | Source |
| -------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| Field representation | Add nullable `example` + `code_context` columns   | Faithful to FR-012's three-field intent; keeps question separable for S-03's review UI        | Plan   |
| UI surface           | Inline on note detail page                        | FR-015 ("all checks on a given note") makes the detail page the natural home; no route sprawl | Plan   |
| Editor               | Reuse S-01's CodeMirror island                    | Consistent code-authoring experience; code context highlights while typing                    | Plan   |
| Add/edit interaction | One form, toggled per action                      | At most one heavy CodeMirror island alive regardless of check count                           | Plan   |
| Delete UX            | AlertDialog confirm                               | Warns before cascading review history away; matches existing destructive controls             | Plan   |
| Scope                | All fields must-have together                     | No half-built feature; matches FR-012 literally                                               | Plan   |
| Action wrapper       | Promote `runNoteAction` → shared `runTableAction` | This is its 2nd consumer — the AGENTS.md promotion trigger                                    | Plan   |
| E2E                  | Full CRUD + highlight + isolation row             | Covers FR-012–15 end-to-end and re-proves RLS on the new mutation path                        | Plan   |

## Scope

**In scope:** two nullable content columns + typegen; Zod schema; create/update/delete Server
Actions; per-note read helper; inline list + toggled CodeMirror form + AlertDialog delete on the
note detail page; full Playwright spec.

**Out of scope:** any SM-2 scheduling write (S-03 owns it); the review/rating loop; dashboard;
new routes; per-note list pagination.

## Architecture / Approach

Mirror S-01's vertical one tier down (child entity scoped by `note_id`): schema → write/read
layer → inline UI → E2E. The note detail Server Component fetches checks via
`getTopicChecksForNote(id)` and renders them with server-only Shiki; a single client island
(`TopicChecksSection`) owns `editingId` state and hosts the one CodeMirror form (add when
`editingId` is undefined, seeded edit otherwise) plus per-row AlertDialog delete. Mutations send
only `{ note_id, prompt, example, code_context }` — never `user_id` or any SM-2 column.

## Phases at a Glance

| Phase                 | What it delivers                                                   | Key risk                                    |
| --------------------- | ------------------------------------------------------------------ | ------------------------------------------- |
| 1. Schema + typegen   | Two nullable columns + regenerated `Database` types                | Migration timestamp ordering; typegen drift |
| 2. Write + read layer | Promoted `runTableAction`, Zod schema, 3 actions, read helper      | Promotion must not regress notes CRUD       |
| 3. Inline UI          | List + toggled CodeMirror form + AlertDialog delete on detail page | Single-editor `editingId` state correctness |
| 4. E2E                | Playwright CRUD + highlight + isolation spec                       | Known local-GoTrue signup flake             |

**Prerequisites:** S-01 (done), F-02 (done); local Supabase stack up for migration + E2E.
**Estimated effort:** ~1–2 sessions across 4 phases (small, mostly mirrors S-01).

## Open Risks & Assumptions

- `runNoteAction → runTableAction` promotion touches 3 existing notes actions — build must
  confirm no regression (Phase 2 manual check).
- Local-GoTrue signup→dashboard step flakes intermittently — re-run once against a warm server.
- Assumes a note's topic-check count stays small (no pagination), consistent with `target_scale`.

## Success Criteria (Summary)

- A user can attach, edit, delete, and list topic checks on a note; code context renders highlighted.
- Blank optional fields persist as null and render cleanly.
- A second account cannot see or mutate the first account's topic checks (RLS, E2E-proven).
