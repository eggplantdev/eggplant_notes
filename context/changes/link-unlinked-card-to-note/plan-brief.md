# Link an Unlinked Memory Card to an Existing Note — Plan Brief

> Full plan: `context/changes/link-unlinked-card-to-note/plan.md`

## What & Why

The app can detach a card from its note (`unlinkCardFromNote`) but has no inverse — a standalone
card can't be attached to an existing note. This adds that missing piece: link a card to a note from
the cards listing, the card view page, and the edit form.

## Starting Point

Cards carry two nullable FKs — `subject_id` and `note_id` — coupled by an invariant: a linked card
always shares its note's subject (enforced at insert in `insert-cards-for-note.ts` and at edit in
`card-form.tsx`). The reverse action, dialog patterns (`move-linked-cards-dialog`), `Combobox`,
`subject-select`, and subject-scoped note querying (`getNotes`) all already exist.

## Desired End State

An unlinked card shows a "Link to note" affordance on all three surfaces. The user picks a subject
(which scopes a note search) and a note; on link the card attaches and adopts the note's subject.
Once linked, the affordance disappears.

## Key Decisions Made

| Decision               | Choice                                                | Why                                                           | Source     |
| ---------------------- | ----------------------------------------------------- | ------------------------------------------------------------- | ---------- |
| Subject on link        | Derived from the chosen note, server-side             | Invariant holds by construction; note is source of truth      | Brainstorm |
| Subject-select role    | Filters the note list (required, single)              | Bounds the notes payload; also = the card's resulting subject | Brainstorm |
| Subject-change warning | None                                                  | The picker is the visible control — nothing is silent         | Brainstorm |
| Trigger when linked    | Hidden, not disabled                                  | Mirrors how Unlink only renders when linked                   | Brainstorm |
| Unfiled-card default   | Pre-fill "None"                                       | Keeps card unfiled unless deliberately changed                | Plan       |
| Already-linked guard   | None — trust UI gating, overwrite                     | Mirrors `unlinkCardFromNote`'s no-precheck design             | Plan       |
| Loading UX             | Spinner while notes fetch                             | Clear feedback on subject change                              | Plan       |
| Testing                | Manual + one E2E spec                                 | Matches repo's no-unit-test-for-RLS-actions convention        | Plan       |
| Notes loading          | Load full subject-scoped set (cap 200), client-filter | `Combobox` is client-filter only; subject scoping bounds it   | Plan       |

## Scope

**In scope:** `linkCardToNote` action; `getNotesForLinking` query + server-action wrapper;
`LinkCardToNoteDialog`; `linkControl` slot on `CardActions`; triggers on listing, card view, edit
form; one E2E spec.

**Out of scope:** server-side note search/pagination in the dialog; bulk linking; linking from the
note side; drag-drop; defensive already-linked precheck; unit tests; any schema/migration.

## Architecture / Approach

Bottom-up. A new action mirrors `unlinkCardFromNote` but writes `{ note_id, subject_id: note.subject_id }`
(subject derived from the note, per `insert-cards-for-note.ts`). A slim `getNotesForLinking` query
adds the `subject_id IS NULL` branch `getNotes` lacks, exposed to the client via a server-action
wrapper (same pattern as `generate-cards`). One self-contained client dialog drives subject → note →
link. Three triggers each conditionally render the dialog when `card.note_id` is null.

## Phases at a Glance

| Phase       | Delivers                                                   | Key risk                                     |
| ----------- | ---------------------------------------------------------- | -------------------------------------------- |
| 1. Backend  | `linkCardToNote` + `getNotesForLinking` (+ action wrapper) | Subject must derive from note, not filter    |
| 2. Dialog   | `LinkCardToNoteDialog` (subject→note→link, spinner)        | Refetch-on-subject-change effect correctness |
| 3. Triggers | `linkControl` slot + 3 wired surfaces                      | Edit-form Link/Unlink row mutual exclusivity |
| 4. E2E      | Playwright spec asserting subject adoption                 | Seeding a standalone card via UI             |

**Prerequisites:** local Supabase up for Phase 4 E2E.
**Estimated effort:** ~1 session across 4 phases.

## Open Risks & Assumptions

- Assumes a note can host multiple cards (it can) — no filtering of "notes that already have cards".
- 200-note cap per subject is generous for a personal app; older notes beyond it aren't searchable
  in the dialog (acceptable; logged via comment).

## Success Criteria (Summary)

- An unlinked card can be linked to a note from all three surfaces; the trigger is gone once linked.
- The linked card's subject matches its note's subject (including cross-subject re-filing and "None").
- E2E spec proves the subject-adoption invariant end-to-end.
