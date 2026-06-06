# Review gate — deferred follow-ups

Review fan-out (2026-06-06) returned APPROVED / clean on all four checks. One deferred item.

## Deferred

- **"check" → "card" vocabulary/copy drift** (surfaced by `/simplify`, 2026-06-06).

  DONE (`e128ab5`) — user-facing copy in clean files:
  - `add-memory-card.tsx` button "Add check" → **"Add card"**.
  - `memory-card-form.tsx` toasts "Check saved/added" → **"Card saved/added"**.
  - `delete-memory-card-button.tsx` toast "Check deleted" → **"Card deleted"**.
  - e2e selectors (`helpers.ts`, `memory-cards`, `create-note-with-checks`, `notes`) + the
    "Card added" assertion (`action-feedback-toasts`) updated to match.

  STILL DEFERRED — internal identifiers in files the parallel session is actively editing:
  - `getChecksForStats` (`queries.ts:41`), `checks` prop on `MemoryCardsList`/`MemoryCardsSection`,
    `checks` local in `memory-cards/page.tsx` (DIRTY — parallel), `editingCheck`.
  - the `#check-<id>` deep-link anchor (`memory-cards-section.tsx` ↔ `memory-cards-list.tsx`) — a
    card→note contract, E2E-asserted; connects to the dirty page.tsx prop, so rename all in one move.
  - SQL `tc` aliases in `seed.sql` + `generate-section-seed.mjs` (cosmetic).
    Apply once the parallel session lands (overlaps `memory-cards/page.tsx` + the FSRS constants).

- **`FSRS_STATE_LABELS` triplicated** (reuse agent). Same array in `dashboard/constants.ts:22`,
  `memory-cards/constants.ts` (a parallel-session file), and as `STATE_LABEL` in
  `memory-cards/utils/format-review-status.ts:5`. Promote one copy to a shared tier (2nd+ consumer)
  and delete the duplicates. Entangled with the parallel session's own constants/types reorg —
  coordinate; do not fix unilaterally.

  > NOTE: during the `/simplify` run, a cleanup agent `rm`'d `memory-cards/constants.ts` as a
  > "dead orphan"; it is in fact the parallel session's file (imported by their untracked
  > `cards-overview.tsx`) and was restored. No committed damage. Logged as a collision-hazard data point.

## Dismissed (verified benign)

- impl-review F2: `memory-card-actions.tsx` superseded by shared `components/ui/card-actions.tsx`
  (parallel session commit `4201c90`) — resolved cleanly, no orphan.
- impl-review F3: residual `topic_check` strings are all documented exceptions (slice-ids
  `attach-topic-checks`/`topic-checks-listing`, archive paths, kept non-init migration filename).

## Acknowledged

- e2e 3.5 not cleanly green: combobox ambiguity fixed in `ace8b22`; residual reds are the
  documented GoTrue sign-up flake (`retries:2`, lessons.md). Re-verify with a clean `db reset`
  once the parallel session's new migrations (`auto_bump_updated_at`, `record_review_drop_updated_at`)
  have landed.
