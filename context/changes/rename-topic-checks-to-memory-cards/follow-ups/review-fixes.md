# Review gate — deferred follow-ups

Review fan-out (2026-06-06) returned APPROVED / clean on all four checks. One deferred item.

## Deferred

- **Internal "checks" vocabulary residue** (feature-first-structure, minor obs). The rename
  retargeted `topic_checks` → `memory_cards` everywhere, but feature-internal short-name
  identifiers still read "checks": `getChecksForStats` (`src/features/memory-cards/queries.ts:41`),
  the `checks` prop on `MemoryCardsList` + the `checks` local in
  `src/app/(protected)/memory-cards/page.tsx`. Cosmetic, feature-internal, not a structure
  violation. Deferred because (a) it's out of the mechanical topic_checks→memory_cards scope and
  (b) these files overlap an active parallel session (CardActions/ReviewPanel/moddatetime work).
  Fix when that session settles: `checks`→`cards`, `getChecksForStats`→`getCardsForStats`.

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
