# Move the Review Session onto the Dashboard — Implementation Plan

## Overview

Relocate the sequential FSRS review session from its own `/review` route onto `/dashboard` as a
panel below the activity-heatmap card, then delete the `/review` route. Pure relocation — **no
caching** (deferred to S-11). The rating action already revalidates `/dashboard`, so the
post-rate "advance to next card" works on the dashboard out of the box.

## Current State Analysis

- `/review` (`src/app/(protected)/review/page.tsx:19-89`) is a Server Component that fetches
  `Promise.all([getDueQueue(), getDailyGoal()])`, computes interval `previews` server-side, and
  wraps a `card ? recall+RatingButtons : "All caught up"` branch in `<ReviewCelebrationProvider>`
  with `<GoalCelebrationDialog>` as a provider sibling.
- The advance is server-driven: `rateTopicCheck` (`src/features/review/actions/rate-topic-check.ts`)
  calls `revalidatePath('/review')` (`:74`) **and** `revalidatePath('/dashboard')` (`:75`); the
  re-render drops the just-rated card and renders the next due one — no client queue state.
- `/dashboard` (`src/app/(protected)/dashboard/page.tsx`) is a Server Component using default
  `PageShell` width (`full`, max-w-120rem). It **already** fetches `getDailyGoal()` (`:33`). The
  activity-heatmap card sits at `:85-92`. The "Due today" `StatCard` is wrapped in
  `<Link href="/review">` (`:96-101`).
- Nav lists `/review` at `src/components/app-nav/nav-items.ts:7`.
- `next.config.ts:9-17` defines one redirect (`'/' → '/dashboard'`, permanent).

### Key Discoveries:

- **Advance already works on the dashboard** — `rate-topic-check.ts:75` already revalidates
  `/dashboard`; only the now-dead `:74` `/review` call is removed.
- **Celebration-survives-unmount is load-bearing** (`lessons.md:119-124`,
  `review-celebration-context.tsx:14-32`): rating the last card flips `card`→undefined and
  unmounts `RatingButtons`; the provider + dialog must live **above** that branch so the
  celebration survives.
- **Width is page-level** (`page-shell.tsx:39-43,84`): `PageShell.width` can't scope a section,
  so the embedded panel needs its own inline `mx-auto w-full max-w-2xl` wrapper.
- `getDueQueue()` returns `{ first?: DueCardT; count }`, `DueCardT` embeds `notes(title)` in one
  round-trip (`topic-checks/types.ts:10`) — no extra fetch for the source-note link.
- Typed routes are ON: after deleting the route, run `pnpm exec next typegen` before
  `pnpm typecheck`/`build` (`lessons.md:105-110`).

## Desired End State

`/dashboard` shows the review session as a prose-width (max-w-2xl) panel below the heatmap:
the recall card (or compact "All caught up" state) + rating buttons, with confetti/goal-dialog
intact. Rating a card advances to the next one and refreshes the dashboard stats it changed.
`/review` no longer exists; visiting it redirects to `/dashboard`. The "Review" nav item is gone.
`pnpm typecheck`, `pnpm lint`, `pnpm build`, and the (repointed) E2E suite pass.

## What We're NOT Doing

- **No caching of any kind** — no `unstable_cache`, `'use cache'`, `cacheTag`, `revalidateTag`,
  no service-role client, no RLS-vs-cache work. All of that stays S-11. The aggregates recompute
  on each advance; that felt cost rides until S-11.
- No stats-section trim, no over-fetch cleanup.
- No change to the FSRS scheduling, the `record_review` RPC, `getDueQueue`, or any data read.
- No client-side queue state — the panel stays server-rendered.
- Not repositioning the panel beyond "below the heatmap" (operator will move it later).

## Implementation Approach

Lift the review panel's JSX + data fetch into the dashboard page, add `getDueQueue()` to the
dashboard's existing `Promise.all`, render the panel (provider + branch) below the heatmap inside
a prose-width wrapper, then delete the route and clean up the references (redirect, nav, dead
revalidate, self-referential links). Finally repoint the two E2E specs that navigate to `/review`.

## Phase 1: Relocate the review panel and remove the route

### Overview

Embed the review session on the dashboard, delete `/review`, and clean up every reference.

### Changes Required:

#### 1. Dashboard page — fetch the queue and render the panel

**File**: `src/app/(protected)/dashboard/page.tsx`

**Intent**: Add `getDueQueue()` to the existing `Promise.all` (alongside the already-present
`getDailyGoal()`), compute the interval `previews` server-side exactly as `review/page.tsx` does,
and render the review panel below the heatmap card. Drop the `<Link href="/review">` wrapper from
the "Due today" `StatCard`, leaving the card as a plain stat.

**Contract**: New imports from `@/features/review/*` (`RatingButtons`, `ReviewCelebrationProvider`,
`previewIntervals`) and `@/features/topic-checks/queries` (`getDueQueue`) + `format-interval`. The
panel is inserted immediately after the heatmap card (`:92`), wrapped in
`<div className="mx-auto w-full max-w-2xl">` so it keeps prose width inside the full-width page.
The `ReviewCelebrationProvider` wraps **both** branches of `card ? recall+RatingButtons : empty`,
with `<GoalCelebrationDialog>` remaining a provider sibling (preserve the survives-unmount
structure). The "All caught up" state renders **compact inline** (no full Card, no
"Back to dashboard" button — it would be self-referential). The recall card keeps its
`From: {notes.title}` link to `/notes/${note_id}`.

#### 2. Delete the review route

**File**: `src/app/(protected)/review/page.tsx` (delete)

**Intent**: Remove the route now that its content lives on the dashboard.

**Contract**: Delete the file (and the empty `review/` dir). Run `pnpm exec next typegen` before
typecheck/build so the generated `AppRoutes` union drops `/review`.

#### 3. Redirect `/review` → `/dashboard`

**File**: `next.config.ts`

**Intent**: Catch old bookmarks/links to `/review`.

**Contract**: Add a second entry to the `redirects()` array: `{ source: '/review', destination:
'/dashboard', permanent: false }`. Use `permanent: false` (307) — unlike the root redirect, this
is a relocation that could plausibly revert, and a 308 gets aggressively browser-cached.

#### 4. Remove the nav item

**File**: `src/components/app-nav/nav-items.ts`

**Intent**: Drop the now-dead "Review" tab.

**Contract**: Remove the `{ href: '/review', label: 'Review' }` entry (`:7`).

#### 5. Drop the dead revalidate in the rate action

**File**: `src/features/review/actions/rate-topic-check.ts`

**Intent**: `/review` no longer exists; its revalidation is a no-op. Keep the `/dashboard`
revalidation — it's what drives the advance now.

**Contract**: Remove `revalidatePath('/review')` (`:74`); keep `revalidatePath('/dashboard')`
(`:75`). Update the explanatory comment at `:14-18` to reference the dashboard, not `/review`.

### Success Criteria:

#### Automated Verification:

- Typegen + type check pass: `pnpm exec next typegen && pnpm typecheck`
- Lint passes: `pnpm lint`
- Production build passes: `pnpm build`
- No remaining references to the `/review` route: `grep -rn "/review" src` returns only narrative
  comments (no `href`/`goto`/`revalidatePath`/nav targets)

#### Manual Verification:

- `/dashboard` shows the review panel below the heatmap at prose width; recall card + rating
  buttons render with correct interval previews.
- Rating a card advances to the next due card and the dashboard stats (due-today, streak,
  state-breakdown, etc.) reflect the rating.
- Rating the **last** due card shows the "All caught up" compact state AND the goal-celebration
  dialog/confetti still fires (survives-unmount preserved).
- The "From: <note title>" link on a card navigates to the source note.
- Visiting `/review` redirects to `/dashboard`; the "Review" nav item is gone; the "Due today"
  card renders without a link.

**Implementation Note**: After Phase 1 passes automated verification, pause for manual
confirmation before Phase 2.

---

## Phase 2: Repoint the E2E specs

### Overview

The two specs that navigate directly to `/review` must target the dashboard panel instead.
Per the project review gate, this phase runs **after** review + `/simplify`, as the test layer.

### Changes Required:

#### 1. Review loop + isolation specs

**File**: `e2e/review.spec.ts`

**Intent**: Both tests `page.goto('/review')` (`:28`, `:88-89`). Repoint to `/dashboard` and
locate the review panel there; the rate/advance and RLS-isolation assertions are otherwise
unchanged (the UI and action are identical, only the host page moved).

**Contract**: Replace `goto('/review')` with `goto('/dashboard')` and scope the card/rating-button
locators to the review panel region on the dashboard. Keep the full-loop and per-account isolation
assertions.

#### 2. Card-to-note link spec

**File**: `e2e/card-to-note.spec.ts`

**Intent**: `page.goto('/review')` (`:20`) → `/dashboard`; assert the source-note link from the
card on the dashboard.

**Contract**: Replace the `goto` target; keep the link assertion.

### Success Criteria:

#### Automated Verification:

- E2E suite passes (local Supabase stack up): `pnpm test:e2e`
- Unit suite still green (route-independent, expected no change): `pnpm test`

#### Manual Verification:

- The repointed specs exercise the panel on the dashboard, not a dead `/review` route.

**Implementation Note**: This is the final phase before the review gate's archive step.

---

## Testing Strategy

### Unit Tests:

- No changes expected — `goal-crossing`, `review-scheduling`, `dashboard-streak`,
  `dashboard-heatmap-matrix`, `daily-goal`, `week-count` are all logic tests, route-independent.

### Integration / E2E Tests:

- Repoint `review.spec.ts` (full loop + RLS isolation) and `card-to-note.spec.ts` from `/review`
  to the dashboard panel (Phase 2).
- `dashboard.spec.ts` needs no route change; sanity-check it still passes with the new panel
  present.

### Manual Testing Steps:

1. Seed a user with due cards (`dev@example.com` / `password123`), open `/dashboard`, rate
   through the queue, confirm advance + stats refresh.
2. Rate the last due card; confirm "All caught up" + goal celebration fires.
3. Visit `/review` directly; confirm 307 redirect to `/dashboard`.
4. Confirm the "Review" nav item is gone and the "Due today" card has no link.

## Performance Considerations

The dashboard already runs its aggregate reads on every load; embedding review means each rating
re-renders the dashboard (recomputing those aggregates) instead of the lighter `/review` page.
This is the **accepted** S0 cost — targeted invalidation to avoid it is S-11's job. No mitigation
in this slice.

## Migration Notes

No data migration. The `/review` → `/dashboard` redirect (307) covers existing bookmarks. Run
`pnpm exec next typegen` after deleting the route so typed-route checks pass.

## References

- Research: `context/changes/review-on-dashboard/research.md`
- Identity + decision log: `context/changes/review-on-dashboard/change.md`
- Survives-unmount pattern: `context/foundation/lessons.md:119-124`
- Typegen-after-route-change: `context/foundation/lessons.md:105-110`
- Source panel: `src/app/(protected)/review/page.tsx:19-89`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Relocate the review panel and remove the route

#### Automated

- [x] 1.1 Typegen + type check pass: `pnpm exec next typegen && pnpm typecheck` — b2eed64
- [x] 1.2 Lint passes: `pnpm lint` — b2eed64
- [x] 1.3 Production build passes: `pnpm build` — b2eed64
- [x] 1.4 No remaining `/review` route references in `src` (grep clean of href/goto/revalidate/nav) — b2eed64

#### Manual

- [ ] 1.5 Review panel renders below heatmap at prose width with correct previews
- [ ] 1.6 Rating advances to next card and dashboard stats reflect the rating
- [ ] 1.7 Rating the last card shows "All caught up" AND the goal celebration fires
- [ ] 1.8 "From: <note title>" link navigates to the source note
- [ ] 1.9 `/review` redirects to `/dashboard`; nav item gone; "Due today" card has no link

### Phase 2: Repoint the E2E specs

#### Automated

- [ ] 2.1 E2E suite passes: `pnpm test:e2e`
- [x] 2.2 Unit suite still green: `pnpm test` — 6e147fd

#### Manual

- [ ] 2.3 Repointed specs exercise the dashboard panel, not a dead `/review` route
