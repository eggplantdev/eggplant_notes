# Implementation review — rename-topic-checks-to-memory-cards

Review-gate fan-out (read-only, 4 checks), 2026-06-06. Full triage in `../follow-ups/review-fixes.md`.

## Verdict: APPROVED

| Check                                           | Verdict                                                                                                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/10x-impl-review` (correctness/drift/patterns) | **APPROVED**, 0 critical. RPC param + `review_events.memory_card_id` column consistent end-to-end between the migration and `rate-memory-card.ts`. |
| `tailwind-v4-audit`                             | Clean — no findings (rename carries no styling payload).                                                                                           |
| `feature-first-structure`                       | PASS — `memory-cards/` is a clean leaf; deletion test passes; no cross-feature deep imports.                                                       |
| `module-cohesion-audit`                         | 0 issues — every file single-concern.                                                                                                              |

## Key evidence

- Rename faithful end-to-end: no `topic_check` in `src/`, `supabase/` (schema/RLS/RPCs), `e2e/`, generated `types.ts`, or live `context/foundation/` docs. Residuals are documented exceptions only (slice-ids `attach-topic-checks`/`topic-checks-listing`, archive paths, the kept non-init migration filename).
- `record_review(p_memory_card_id, …)` signature + `insert into review_events (memory_card_id, …)` match the TS caller; generated types regenerated, not hand-edited.
- Deterministic gates green: `typecheck`, `lint`, 61 unit tests, `build` (route table shows `/memory-cards`).

## `/simplify` (serial, after fan-out)

Surfaced real "check"→"card" drift the mechanical rename missed. Applied (commits `e128ab5`, `252f724`):

- User-facing copy: "Add check" → "Add card"; toasts "Check added/saved/deleted" → "Card …".
- Internal identifiers: `checks`→`cards` props/locals; `#check-`→`#card-` deep-link anchor (id + href + e2e regex in sync); `getChecksForStats`→`getCardsForStats`.
- FSRS dedup: `format-review-status.ts` imports `FSRS_STATE_LABELS` from `constants` (dropped duplicate `STATE_LABEL`).

Deliberately skipped: SQL `tc` alias (collateral risk on "etc." in seed bodies + generated-block drift); comment-prose "check" (the `with check` RLS keyword is a blanket-sweep landmine).

## E2E status

Not cleanly green as a full suite — blocked by the documented local GoTrue sign-up flake (`lessons.md`, `retries:2`), severe after this session's repeated runs. The rename's own spec `memory-cards.spec.ts` and the `#card-`-anchor-asserting `memory-cards-listing.spec.ts` both pass in isolation on a fresh GoTrue (`db reset`). Same env-block as the comparable S-17 listing slice, which shipped verified-by-deterministic-gates + manual.
