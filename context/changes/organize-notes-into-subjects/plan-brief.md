# Organize Notes into Subjects — Plan Brief

> Full plan: `context/changes/organize-notes-into-subjects/plan.md`

## What & Why

Add a **subject** grouping layer above the existing flat notes: create a subject, assign notes
to it, drag-reorder them, and read the subject as one continuous document — while each note
stays individually editable. This is the v2 differentiator (knowledge stays linked, not
scattered) and the adoption driver behind US-01 / roadmap S-06 / Linear EX-368.

## Starting Point

The live product has flat, ungrouped `notes` with a clean, single-pattern vertical (schema +
per-action RLS using `(select auth.uid()) = user_id`, typed `Database` clients, injectable
`runTableQuery` reads + `runTableAction` mutations that never send `user_id`). There is **no
ordering column anywhere** and **no drag library installed**. No real data exists, so the
structural change is clean.

## Desired End State

A signed-in user creates a subject (title + optional description), assigns notes to it from the
note form (or leaves them unassigned), drags to reorder, and opens `/subjects/[id]` to read all
member notes in order as one Shiki-rendered document — each section linking to its own editable
note. Deleting a subject detaches its notes (they survive, unassigned), never destroying them.
Per-user isolation holds across the new table.

## Key Decisions Made

| Decision                 | Choice                                                 | Why (1 sentence)                                                                 | Source |
| ------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------- | ------ |
| `subject_id` nullability | Nullable, no catch-all "Inbox"                         | PRD AC: a note belongs to one subject or none                                    | PRD    |
| Ordering representation  | Fractional `numeric` position                          | Drag-to-any-slot needs cheap single-row midpoint inserts, not an N-row renumber  | Plan   |
| Reorder UX               | Drag-and-drop (`@dnd-kit`)                             | User chose arbitrary-slot reordering over up/down buttons                        | Plan   |
| Subject delete           | Detach (FK `on delete set null`)                       | Non-destructive; deleting a grouping must never destroy knowledge                | Plan   |
| Assignment locus         | Subject `<select>` on the note form                    | One locus, reuses existing form + action; least code under deadline              | Plan   |
| Document view            | Read-only concatenation + per-section link             | Satisfies "read as one document, each note addressable" via existing render path | Plan   |
| Subject shape            | `title` + optional `description`; create/rename/delete | Minimal schema satisfying US-01, symmetric with notes                            | Plan   |

## Scope

**In scope:** `subjects` table + RLS; `notes.subject_id` (set-null FK) + `position`; subjects
CRUD; note-form assignment; `/subjects` list + `/subjects/[id]` document view; drag-reorder;
E2E incl. isolation.

**Out of scope:** catch-all Inbox; cascade-delete of notes; inline editing in the document view;
batch "add notes" picker; subject color/icon; section-level (heading-anchor) navigation; reverse
"all cards from this note" view; any recall-loop / auth / RLS-idiom change.

## Architecture / Approach

Mirror the `notes` vertical for `subjects` (schema → typed layer → queries/actions → routes/UI),
then thread the nullable `subject_id` + `position` between them. Assignment reuses
`createNote`/`updateNote` (extended Zod schema, sets `position = max+1` on assign / `null` on
unassign). Drag-reorder is isolated to a **client island rendering note titles only** (a
reorderable table of contents) so the heavy Shiki document body stays a server component; the
island calls a dedicated `reorderNote` action that writes a single fractional `position =
midpoint(prev, next)`.

## Phases at a Glance

| Phase                      | What it delivers                                                              | Key risk                                                      |
| -------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1. Migration + typegen     | `subjects` table + RLS; `notes.subject_id` + `position`; regen types          | RLS idiom must match exactly; verify via `pg_catalog`         |
| 2. Data layer + assignment | subjects queries/actions; note assign sets `position`                         | Keeping `subject_id`/`position` consistent across write paths |
| 3. Subject UI + picker     | `/subjects` list + document view; note-form `<select>` (adds shadcn `select`) | Cross-user assignment guardrail (read-scoped picker + RLS)    |
| 4. Drag-to-reorder         | `@dnd-kit` island + `reorderNote` midpoint action                             | pnpm `allowBuilds`; optimistic-update revert on failure       |
| 5. E2E                     | CRUD + assign + reorder-persist + detach + isolation                          | local-GoTrue sign-up flake (use `e2e/helpers.ts` chokepoint)  |

**Prerequisites:** S-01 (notes capture) — done. Local Supabase stack up for migration + E2E.
**Estimated effort:** ~2–3 sessions across 5 phases.

## Open Risks & Assumptions

- **Cross-user subject assignment**: RLS on `notes` UPDATE checks the note's owner but not that
  `subject_id` points to a subject the caller owns. Guardrail is the read-scoped subject picker +
  RLS on both tables; a DB-level trigger check is out of scope (noted in plan).
- **Fractional precision**: `numeric` (not float) avoids the precision cliff; no rebalance path
  needed at MVP scale.
- Assumes no real data to migrate (PRD-confirmed).

## Success Criteria (Summary)

- Create a subject, assign + drag-reorder notes, read them as one ordered document — order
  persists across reloads.
- Deleting a subject leaves its notes intact and unassigned (cards/reviews untouched).
- A second user can never see or open the first user's subjects (RLS, negative-control verified).
