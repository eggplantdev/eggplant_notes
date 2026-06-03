# S-03 close-recall-loop — review-gate follow-ups

Items surfaced during the per-slice review gate (`/10x-impl-review` + `/simplify`). All were
**resolved within the gate** (the user opted to fix the initially-deferred ones rather than ship
them). Kept here for archive traceability.

## Resolved

- **`/review` over-fetch → FIXED.** Replaced `getTopicChecksDue()` (fetched all due rows to render
  one card) with `getDueQueue()` — a `limit(1)` row + `count: 'exact'` in one round-trip
  (`src/features/topic-checks/queries.ts`). `getTopicChecksDue` removed (was its only consumer).

- **Shared action-transition scaffold → FIXED.** Extracted `useActionTransition`
  (`src/hooks/use-action-transition.ts`); adopted by `features/review/rating-buttons.tsx` and
  `features/topic-checks/delete-topic-check-button.tsx` (the 2nd consumer triggered promotion).

- **Duplicated e2e note/check setup → FIXED.** Promoted `createNote` / `attachCheck` to
  `e2e/helpers.ts`; adopted in `review.spec.ts` and `topic-checks.spec.ts`.

- **Grade-metadata scatter → FIXED.** Single source `src/features/review/grades.ts`
  (`{grade,label,variant}`, plain data — no ts-fsrs, so the client island stays bundle-light).
  `scheduling.ts` derives its grade list from it; `rating-buttons.tsx` renders from it.
