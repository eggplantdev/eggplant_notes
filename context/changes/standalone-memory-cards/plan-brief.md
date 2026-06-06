# Standalone Memory Cards — Plan Brief

> Full plan: `context/changes/standalone-memory-cards/plan.md`
> Research: `context/changes/standalone-memory-cards/research.md`

## What & Why

Today a memory card can only be created from inside a note, can only be edited on the note page, and has no subject of its own (subject is inferred through the note). We want to: create cards directly ("New card" on the dashboard + `/memory-cards`), edit any card's content **and** subject from one place, and manage the card↔note link from both sides. To do it cleanly we **decouple cards from notes** rather than auto-spawning a phantom note per card.

## Starting Point

`memory_cards.note_id` is `NOT NULL FK → notes` — a card can't exist without a note, and has no subject of its own. The only create path is the in-note inline add; the only edit path is the note page's `?edit=<cardId>` form (so standalone cards would have no edit surface). The relationship is **one note → many cards** (a card has a single `note_id`).

## Desired End State

A user clicks "New card", writes a card, optionally picks a subject, submits, and lands on `/memory-cards` — no note created. Every card (linked or standalone) edits content + subject at one route, `/memory-cards/[id]/edit`. A card's subject is its own app-owned property (single read source), editable. The note link is optional source context: seeded at create-from-note, removable via Unlink from either side. Changing a note's subject **asks** whether to move its linked cards too (no silent cascade).

## Key Decisions Made

| Decision                             | Choice                                                                      | Why                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Can a card exist without a note?     | Yes — `note_id` nullable                                                    | Simpler model, no phantom notes                                                     |
| Where does a card's subject live?    | `memory_cards.subject_id`, app-owned, on every card                         | Single read source; editable (a trigger can't coexist with editing)                 |
| DB triggers for subject sync?        | **None**                                                                    | App owns every `subject_id` write; the only cross-entity behavior is user-confirmed |
| Subject of a card added from a note  | Seeded from the note at create (app-level), then editable                   | Convenience default, not a lock                                                     |
| Card editing                         | **One** route `/memory-cards/[id]/edit` for all cards (content + subject)   | Single surface, no note-page coupling, no drift                                     |
| Note-subject change → linked cards   | Confirm dialog → bulk move (overwrites all linked)                          | User is authority; no spooky cascade, no orphan drift                               |
| card↔note link                       | One `note_id` per card; unlinkable to null from card side **and** note side | Decouples subject from the note; keeps the card + subject on unlink                 |
| Subject required in standalone form? | Optional (`subject_id` nullable)                                            | Unfiled cards allowed                                                               |
| After create →                       | Redirect to `/memory-cards`                                                 | User's call                                                                         |

## Scope

**In scope:** nullable `note_id` + `memory_cards.subject_id` + RLS subject-ownership; read-path/type updates; app-level subject seeding in `createMemoryCard`; `createStandaloneCard`; `updateMemoryCard` gains `subject_id` (signature → `(id, input)`); `unlinkCardFromNote`; shared `card-form.tsx` (standalone create + edit-any + source-note Unlink); `/memory-cards/new` + `/memory-cards/[id]/edit` routes; strip in-note inline edit + repoint `memoryCardEditHref`; "New card" buttons; null-note handling in list/stats/delete; note-subject confirmed bulk-move; per-card Unlink in the note's card section.

**Out of scope:** card-to-many-notes join table; data backfill (seed regenerates); subject picker on the in-note inline add form; new `/review` route.

## Architecture / Approach

DB-up, four phases. Subject is a first-class app-owned card property; reads use `memory_cards.subject_id` (join notes only for the optional title). **No triggers** — app code owns subject writes; the one cross-entity behavior (note-subject → cards) is an explicit confirmed bulk update. Two thin card forms: `memory-card-form.tsx` (in-note inline **add**, no subject picker) and `card-form.tsx` (route form: standalone create + edit-any, subject picker + unlink). Mirrors the `/notes/new` route + action + `toastRedirect` pattern and reuses the subject `Combobox`.

## Phases at a Glance

| Phase                          | Delivers                                                                                                                                           | Key risk                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1. Decouple data model         | Nullable `note_id`, card `subject_id`, RLS, read paths/types, app-level subject seed (no triggers)                                                 | Regenerating Supabase types; seed update                                   |
| 2. Unified create + edit       | `card-form.tsx`, `createStandaloneCard`, `updateMemoryCard`+subject, `unlinkCardFromNote`, `/new` + `/[id]/edit` routes, strip in-note inline edit | Form-role split fidelity; `updateMemoryCard` signature change blast radius |
| 3. Entry points + null-note UI | "New card" buttons; safe list/stats/delete; edit affordance for all cards                                                                          | Missing a `note_id` deref → `/notes/undefined`                             |
| 4. Note-side link mgmt         | Confirmed bulk-move on note-subject change; per-card Unlink in note section                                                                        | Confirm-dialog wiring; bulk overwrites all linked subjects (intended)      |

**Prerequisites:** local Supabase stack up (`supabase start`); regenerate Supabase types after the Phase-1 migration.
**Estimated effort:** ~3–4 sessions across 4 phases.

## Open Risks & Assumptions

- Bulk-move overwrites **all** linked cards' subjects (the confirm dialog is the safety; no dirty-flag tracking) — intended.
- `updateMemoryCard` signature changes from `(noteId, id, input)` to `(id, input)` — update all callers.
- Supabase generated types must be regenerated/committed or typecheck fails against the old shape.

## Success Criteria (Summary)

- Create a note-less card from the dashboard; it appears in `/memory-cards` (filed or unfiled), reviews without a source-note link, edits (content + subject) at `/memory-cards/[id]/edit`, and deletes — `/notes` un-polluted.
- Add a card from a note → edit → Unlink → it survives standalone with its subject.
- Change a note's subject with linked cards → confirm prompt moves them (or not); plain edits never prompt.
- No regressions to existing note add/review flows.
