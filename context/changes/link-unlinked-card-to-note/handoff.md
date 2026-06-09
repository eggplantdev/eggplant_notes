# Handoff — link-unlinked-card-to-note

> Written 2026-06-09 before a context clear. Resume with `/10x-e2e link-unlinked-card-to-note phase 4`
> (or `/10x-implement …` if only finishing manual sign-off). Read `plan.md` + `plan-brief.md` first.

## What this change is

The inverse of unlink: attach a standalone memory card (`note_id = null`) to an existing note via a
shared dialog reachable from the cards listing, the card view page, and the edit form. The card
adopts the chosen note's subject **server-side** (the note is the source of truth), so the invariant
"a linked card shares its note's subject" holds by construction.

## Branch / repo state

- **Branch: `feat/new-user-welcome-dialog`** (NOT a dedicated branch — committed here by user choice).
  **Unpushed.** A **parallel session** is also committing `clc-api-crud-endpoints` onto this same
  branch + working tree. → Stage by **explicit path**, check `git branch --show-current` before every
  commit, never `git add -A`.
- My commits (in order):
  - `fd04b3b` p1 — backend: `linkCardToNote` action, `getNotesForLinking` query, `getNotesForLinkingAction` wrapper
  - `80cdf67` p2 — `LinkCardToNoteDialog`
  - `63123d8` p3 — triggers: `CardActions` `linkControl` slot, `LinkCardButton`, listing, card-view page (+`getSubjects`), edit-form Link row
  - `c2c6d74` p4 — E2E spec + 2 dialog fixes (see below)

## Files

New: `actions/link-card-to-note.ts`, `notes/actions/get-notes-for-linking.ts`,
`components/link-card-to-note-dialog.tsx`, `components/link-card-button.tsx`.
Changed: `notes/queries.ts` (+`getNotesForLinking`), `components/ui/card-actions.tsx` (+`linkControl`),
`components/ui/combobox.tsx` (+`modal` passthrough), `memory-cards-list.tsx` (+`subjects` prop),
`memory-cards/page.tsx`, `memory-cards/[id]/page.tsx` (+`getSubjects`), `card-form.tsx` (Link row),
`e2e/standalone-memory-cards.spec.ts` (new link test appended).

## Status (Progress in plan.md is source of truth)

- Phases 1–3: **code complete + committed.** typecheck / lint / production build all green.
- Phase 4: spec + fixes **committed**, but **E2E NOT verified green this session** (4.1, 4.4 open).
  The spec drove the full flow green **once** (reached note-found + link) on a healthy stack; later
  runs flaked because ~6 back-to-back full rebuilds degraded the single GoTrue container.

## Two real bugs the E2E surfaced (already fixed, keep regardless)

1. **Modal dialog dismissed on subject-pick** — the `Combobox` popover portals outside the modal
   `Dialog`, so an option click read as outside-click → dialog closed. Fixed: `modal` prop on
   `Combobox` (mirrors `ModelSelect`), set on both dialog selects.
2. **Note spinner hung forever** on a failed/slow note fetch (no `.catch`). Fixed: `.catch` clears
   loading. Plus `id`/`htmlFor` a11y on the dialog selects.

## TODO to close out (in order)

1. **Manual checks 3.4–3.8** (listing / card-view / edit-form flows + cross-subject re-file + "None"
   → unfiled notes). User was testing; mark the rows when confirmed.
2. **Phase 4 green:** fresh stack → `supabase stop && supabase start` (data-preserving, NOT
   `db reset`) → `pnpm test:e2e standalone-memory-cards -g "adopts the note"`. Kill any lingering
   server first: `lsof -i :3100 -sTCP:LISTEN -t | xargs kill`.
3. **Deliberate-break verify** (skill VERIFY gate): temporarily make `linkCardToNote` NOT set
   `subject_id` (e.g. drop it from the update), confirm the spec goes **red on subject_id**, then
   **revert**. Only then flip 4.1 / 4.4.
4. Commit the SHA write-back + remaining rows; set `change.md` → `implemented`; **epilogue commit**.
5. **`slice-review-gate`** (per AGENTS.md per-change review gate), then **`/10x-archive`**. This is a
   **standalone change** — no roadmap slice, no Linear issue → skip those sync steps; the archive is
   its record.

## Hazards / notes

- **Parallel session's `SubjectSelect` redesign (`9c88e3b`)** broke the sibling **move test**
  (`standalone-memory-cards.spec.ts:79,88`, old `getByRole('combobox',{name:'Subject'})`) and likely
  other specs — **theirs to fix**, not this change. My new test uses the current pattern: the
  note-form subject combobox is unlabeled, scope via `getByRole('radiogroup',{name:'Subject mode'})`
  (`createAssignedNote` in `subjects.spec.ts:32`).
- E2E quirks hit this session: bracket-route staging needs `:(literal)`; cmdk option click on a
  just-mounted popover is unstable → the spec uses **filter + Enter**, not a click.
- `plan.md` may carry a trailing SHA write-back as a small dirty edit — fold it into the close-out commit.
