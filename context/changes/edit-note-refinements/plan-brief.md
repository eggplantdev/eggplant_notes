# Edit-Note Refinements — Plan Brief

> Full plan: `context/changes/edit-note-refinements/plan.md`

## What & Why

A follow-up to S-14. The note **read** view eagerly mounts a CodeMirror editor it doesn't need (the always-on "Add a topic check" form), so every note open downloads + hydrates a heavy client editor. This change defers that editor to on-demand, moves subject assignment into edit mode only, and adds Edit/Delete shortcuts to the notes list so management doesn't require opening each note first.

## Starting Point

`TopicChecksSection` (server) unconditionally renders the add-check `TopicCheckForm` → CodeMirror, even on read. The detail page also shows a `NoteSubjectPicker` (read) that duplicates the edit form's subject `Combobox`. The notes list (`AnimatedCardList`) has a `renderAction` slot that `NotesList` doesn't use. The list-card DOM already changed from `<ul>/<li>` to `<div>` (a flagged e2e TODO).

## Desired End State

Opening a note loads no CodeMirror until the user clicks "Add check" (or edits an existing check). The read view has no Subject control — subject changes happen in edit mode. Each note card has working Edit (→ detail in edit mode) and Delete (confirm dialog) buttons that don't hijack card navigation.

## Key Decisions Made

| Decision                                  | Choice                                             | Why                                                               | Source |
| ----------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------- | ------ |
| Reveal mechanism for add-check form       | Client `useState` toggle                           | Simplest, defers the chunk, no extra navigation                   | Plan   |
| After a successful add                    | Collapse back to button                            | Keeps the read view light again; clear "done" signal              | Plan   |
| List action affordance                    | Text Edit / Delete buttons                         | Explicit, matches the subject-card precedent                      | Plan   |
| List delete behavior                      | Reuse `DeleteNoteButton` as-is (+ stopPropagation) | Zero new code, consistent confirm UX, no silent delete            | Plan   |
| "Edit" on the list                        | Navigate to `/notes/[id]?edit=note`                | No list-inline edit exists; S-14's inline edit is the detail page | Plan   |
| `NoteSubjectPicker` + `assignNoteSubject` | Delete (dead after read-view removal)              | Grep-confirmed sole consumer, no tests                            | Plan   |

## Scope

**In scope:** defer the add-check editor; remove read-view subject picker + dead code; list Edit/Delete shortcuts; fix stale list-view e2e locators.

**Out of scope:** list-inline editing; topic-check edit-existing flow; `AnimatedCardList` internals; `DeleteNoteButton` dialog UX; note body editor; schema/migrations; new deps.

## Architecture / Approach

One new small `'use client'` toggle (`AddTopicCheck`) lets the async server section defer the form. `TopicCheckForm` gets an `onAdded` callback to collapse on create-success. The detail page drops the subject picker render; the component + action are deleted. A new `NoteCardActions` client component fills `AnimatedCardList.renderAction`, reusing `DeleteNoteButton` and routing Edit to `?edit=note`; in-card clicks `preventDefault`/`stopPropagation` per the existing precedent.

## Phases at a Glance

| Phase                         | What it delivers                                                            | Key risk                                                |
| ----------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1. Defer add-check editor     | Read view mounts zero CodeMirror; form opens on demand, collapses after add | Edit-existing (`?edit=<checkId>`) path must stay intact |
| 2. Subject → edit-only        | Read view loses Subject control; dead code removed                          | Stray import / leftover reference                       |
| 3. List edit/delete shortcuts | Per-card Edit + Delete that don't break navigation                          | Trigger click bubbling to card Link; stale e2e locators |

**Prerequisites:** S-14 merged (done). Local Supabase stack up for e2e.
**Estimated effort:** ~1 session across 3 small phases.

## Open Risks & Assumptions

- The deferral assumes `dynamic({ ssr:false })` only fetches its chunk on mount — confirmed by the existing `markdown-editor.tsx` setup.
- E2E locator fix touches both `notes.spec` and `subjects.spec` (shared list primitive); the subject-list assertions may also need the same update.
- `deleteNote` redirects to `/notes`; from the list that's a refresh that drops the row — assumed acceptable (no special post-delete UI needed).

## Success Criteria (Summary)

- Opening a note loads no CodeMirror chunk until "Add check" / `?edit=<checkId>`.
- Subject is settable only in edit mode; no read-view picker, no dead code left.
- Notes list Edit + Delete work without breaking card navigation; full suite green (`typecheck`, `lint`, `test`, `test:e2e`, `build`).
