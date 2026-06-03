# Close the Recall Loop (S-03) — Implementation Plan

## Overview

Close the product's core loop: surface due topic checks, let the user review one and
self-rate **Again / Hard / Good / Easy**, reschedule the next due date with an adaptive
algorithm (**FSRS** via `ts-fsrs`), append a `review_events` row, and show when each check
is next due (FR-016–019). This is the north-star slice — the first end-to-end proof that
adaptive scheduling works.

## Current State Analysis

- **Schema is present but SM-2-shaped and unwritten.** `topic_checks` carries SM-2 columns
  (`ease_factor`, `interval_days`, `repetitions`, `due_at`) defaulted to a fresh-card state
  (`migration 20260603070945:46-57`). `review_events.rating` is `smallint check (rating
between 0 and 5)` — the SM-2 quality grade (`:86-92`). Nothing has ever written these;
  S-03 is the first writer.
- **`getTopicChecksDue()` already exists** (`src/features/topic-checks/queries.ts:16`):
  `from('topic_checks').select('*').lte('due_at', now).order('due_at')`, with the
  `(user_id, due_at)` btree index in place. It currently returns everything only because no
  future `due_at` is ever written; it becomes correct the instant scheduling starts.
- **Write convention is settled.** `runTableAction` (`src/lib/supabase/run-table-action.ts`)
  validates → server client → PostgREST write → `{success}` envelope; actions never send
  `user_id` (DB defaults `auth.uid()`, RLS `with check` guards). Reads use injectable clients
  so Playwright can pass a `signInWithPassword` client (lessons.md).
- **The dashboard shell is on `main` (S-04, HEAD 587d95b).** `(protected)/dashboard/page.tsx`
  renders a `StatCard label="Due today" value={data.dueToday}` + streak + heatmap.
  `src/features/dashboard/data.ts` is **dummy data** with an explicit
  `TODO(S-03 data wiring)`: replace its body with real per-user queries for `dueToday`,
  `currentStreak`, and `activity` (review_events grouped by day). `DashboardDataT`
  (`features/dashboard/types.ts`) is already final — wiring is a body swap, not a type change.
- **No SRS library installed.**
- **RPC precedent exists**: `delete_account()` (`migration 20260603092554`) is the pattern for
  a typed Postgres function + typegen.

## Desired End State

A signed-in user with ≥1 due topic check sees a "Due today" count on the dashboard, clicks
through to `/review`, reviews due checks **one at a time**, and for each sees four rating
buttons each labelled with its predicted next interval (e.g. `Good · 4d`). Rating a check
atomically (a) appends a `review_events` row with the 1–4 grade and (b) updates the check's
FSRS state + `due_at`, then advances to the next due check. When the queue empties the page
shows "All caught up". The dashboard's due count / streak / heatmap reflect real data.

**Verify:** create a note + check, open `/review`, rate it Good — the check disappears from
the queue, a `review_events` row exists, `topic_checks.due_at` is in the future, and the
dashboard "Due today" count drops by one. A second user can never see or review the first
user's checks.

### Key Discoveries

- ts-fsrs API (Context7 `/open-spaced-repetition/ts-fsrs`): `const s = fsrs()`;
  `s.repeat(card, now)` returns all four outcomes keyed by `Rating` (`preview[Rating.Good].card`)
  — use for button previews; `s.next(card, now, rating)` returns `{ card, log }` for the chosen
  grade — use to compute what to persist. `createEmptyCard()` seeds a New card.
- FSRS `Rating`: `Again=1, Hard=2, Good=3, Easy=4`. This maps 1:1 to the four buttons and
  drives the `review_events.rating` `1..4` check.
- FSRS `Card` fields to persist: `due`, `stability`, `difficulty`, `elapsed_days`,
  `scheduled_days`, `learning_steps`, `reps`, `lapses`, `state` (`State`: New=0/Learning=1/
  Review=2/Relearning=3), `last_review?`. `due` ↔ existing `topic_checks.due_at`.
- ts-fsrs is pure JS (no build script) → no `allowBuilds` entry needed in
  `pnpm-workspace.yaml`; don't expect `ERR_PNPM_IGNORED_BUILDS`.

## What We're NOT Doing

- **Not building the dashboard UI** (stat cards / heatmap / streak presentation) — S-04 owns
  it and shipped it. S-03 only fills its data seam + links "Due today" to `/review`.
- **Not tuning FSRS parameters / optimization** (no review-log-based weight optimization). Use
  default `fsrs()` parameters; optimization is post-MVP.
- **Not preserving the SM-2 columns** — they are dropped. No production data exists (S-03 is the
  first writer; local test rows are disposable via `supabase db reset`).
- **Not adding per-check review history UI** beyond what FR-019 needs (next-due display).
- **Not editing checks here** — S-02 owns topic-check CRUD.

## Implementation Approach

FSRS runs **in TypeScript**, server-side. The `/review` Server Component fetches due checks,
computes each card's four-outcome preview with `repeat()` at render, and renders one card with a
client rating island. On a rating, a Server Action re-fetches the card row (never trusts the
client's card state), recomputes the chosen outcome with `next()`, and calls the `record_review`
RPC, which performs both writes in one transaction. `revalidatePath('/review')` re-fetches the
due queue — the just-rated card now has a future `due_at` and drops out, so the next card
appears with no client-side queue state (Server-Components-default; no `useEffect`).

## Critical Implementation Details

- **Server-trusted scheduling.** The rating client island sends only `{ topicCheckId, rating }`.
  The Server Action reconstructs the `Card` from the DB row and runs `next()` itself, so a
  client cannot forge an arbitrary schedule. RLS still scopes the row read/write to the owner.
- **RPC is a dumb atomic writer.** `record_review` does NOT compute FSRS in SQL — it receives
  the already-computed card fields + rating and performs `insert review_events` +
  `update topic_checks` in one function body (one transaction). `SECURITY INVOKER` (default) so
  RLS applies as the calling user — no privilege escalation (unlike S-05's definer RPC, which
  needed to delete the auth row).
- **Row↔Card serialization is the one fiddly seam.** Postgres returns `due_at`/`last_review` as
  ISO strings; ts-fsrs `Card` wants `Date`s. Convert on both edges in `scheduling.ts`. Keep
  this isolated and unit-tested.

---

## Phase 1: Schema migration + ts-fsrs dependency + typegen

### Overview

Migrate `topic_checks` from SM-2 to FSRS state, retune the rating constraint, add the atomic
`record_review` RPC, install ts-fsrs, and regenerate `Database` types.

### Changes Required:

#### 1. FSRS migration

**File**: `supabase/migrations/<timestamp>_fsrs_review_loop.sql` (new)

**Intent**: Replace SM-2 scheduling state with FSRS state on `topic_checks`, retune
`review_events.rating`, and add the review-recording RPC. No production data exists, so this is
additive + drop, not a data backfill.

**Contract**:

- On `topic_checks`: **drop** `ease_factor`, `interval_days`, `repetitions`. **Add** (all
  `not null` with empty-card defaults, so existing rows stay valid as fresh New cards):
  `stability real default 0`, `difficulty real default 0`, `elapsed_days integer default 0`,
  `scheduled_days integer default 0`, `learning_steps integer default 0`,
  `reps integer default 0`, `lapses integer default 0`, `state smallint default 0`,
  `last_review timestamptz` (nullable). **Keep** `due_at timestamptz not null default now()`
  (FSRS `due`) and its `(user_id, due_at)` index.
- On `review_events`: drop the `rating between 0 and 5` check, add `rating between 1 and 4`.
- Add function `record_review(p_topic_check_id uuid, p_rating smallint, p_card jsonb)`,
  `language plpgsql`, `security invoker`, `set search_path = ''` (see F4 below). **Order matters
  — UPDATE first, then guard, then INSERT** (F1, self-defending): `update public.topic_checks set
…fields from p_card… where id = p_topic_check_id`; immediately `if not found then raise
exception 'topic check not found or not owned'; end if;` then `insert into public.review_events
(topic_check_id, rating) values (p_topic_check_id, p_rating)` (user_id defaults `auth.uid()`).
  Return `void`. RLS scopes the UPDATE to the owner, so a foreign/forged id updates 0 rows → the
  `if not found` aborts the whole transaction **before** any review_event is written. This makes
  the RPC enforce the card↔caller link itself, not merely rely on the Server Action's prior
  re-fetch — which is the integrity guarantee the atomic RPC exists for.

  > Snippet justified — the update-first ownership guard + the jsonb→column unpack are the
  > non-obvious parts:
  >
  > ```sql
  > update public.topic_checks set
  >   stability      = (p_card->>'stability')::real,
  >   difficulty     = (p_card->>'difficulty')::real,
  >   elapsed_days   = (p_card->>'elapsed_days')::integer,
  >   scheduled_days = (p_card->>'scheduled_days')::integer,
  >   learning_steps = (p_card->>'learning_steps')::integer,
  >   reps           = (p_card->>'reps')::integer,
  >   lapses         = (p_card->>'lapses')::integer,
  >   state          = (p_card->>'state')::smallint,
  >   due_at         = (p_card->>'due')::timestamptz,
  >   last_review    = (p_card->>'last_review')::timestamptz,
  >   updated_at     = now()
  > where id = p_topic_check_id;
  > if not found then
  >   raise exception 'topic check not found or not owned';
  > end if;
  > insert into public.review_events (topic_check_id, rating)
  > values (p_topic_check_id, p_rating);
  > ```

#### 2. Install ts-fsrs

**File**: `package.json` / `pnpm-lock.yaml`

**Intent**: Add the scheduler dependency.

**Contract**: `pnpm add ts-fsrs`. No `allowBuilds` entry needed (pure JS). Confirm it resolves
and `pnpm build` still passes.

#### 3. Regenerate Database types

**File**: `src/lib/supabase/types.ts`

**Intent**: Reflect the dropped/added `topic_checks` columns, the new rating range, and the
`record_review` function in the typed `Database` so the read helpers, the RPC call, and
`TopicCheckT` stay correct.

**Contract**: After the migration applies to the local DB, regenerate with the established
command (F-02/S-05, Supabase CLI 2.101.0):
`supabase gen types typescript --local > src/lib/supabase/types.ts`. Also add a
`"db:types": "supabase gen types typescript --local > src/lib/supabase/types.ts"` script to
`package.json` for repeatability (net-new; the archives flagged this as a wanted convenience).
`Database['public']['Functions']['record_review']` must appear; `topic_checks.Row` must lose the
SM-2 fields and gain the FSRS ones.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `supabase db reset` (or `supabase migration up`) succeeds.
- `record_review` exists and is `SECURITY INVOKER`: verify via `pg_proc`/`pg_catalog`
  (lessons.md — not `information_schema`).
- `topic_checks` has the FSRS columns and lacks the SM-2 columns: verify via `pg_attribute`.
- `review_events` rating check is `1..4`: verify via `pg_constraint`.
- Typegen regenerated: `src/lib/supabase/types.ts` reflects the new schema; `pnpm typecheck` (or
  `pnpm build`) passes with no type errors in existing `topic_checks` readers.
- Lint passes: `pnpm lint`.

#### Manual Verification:

- `pnpm build` succeeds end-to-end (ts-fsrs resolves, no `ERR_PNPM_IGNORED_BUILDS`).

**Implementation Note**: After this phase and all automated verification passes, pause for
human confirmation before Phase 2.

---

## Phase 2: FSRS scheduling module + review write path

### Overview

Add a `features/review/` feature: a ts-fsrs wrapper with row↔Card serialization, the rating
schema (1–4), and the Server Action that records a review through the RPC.

### Changes Required:

#### 1. Scheduling module

**File**: `src/features/review/scheduling.ts` (new)

**Intent**: Single home for all ts-fsrs interaction so the algorithm choice is swappable and
unit-testable. Convert a `topic_checks` row → ts-fsrs `Card`, expose the four-outcome preview,
and apply a chosen rating → next `Card`.

**Contract**: Export (a) `toCard(row: TopicCheckT): Card` — build a `Card` from the row's FSRS
columns, `due: new Date(row.due_at)`, `last_review: row.last_review ? new Date(...) : undefined`;
(b) `previewIntervals(row, now): Record<Rating, Date>` — `fsrs().repeat(toCard(row), now)`
mapped to each outcome's `card.due`; (c) `applyRating(row, rating, now): Card` —
`fsrs().next(toCard(row), now, rating).card`. A single shared `fsrs()` instance (default
parameters). Keep functions under ~20 lines.

#### 2. Rating schema

**File**: `src/features/review/schemas.ts` (new)

**Intent**: Validate the rating crossing the Server-Action boundary and the target id.

**Contract**: `ratingSchema = z.coerce.number().int().min(1).max(4)` (maps to FSRS
`Rating.Again..Easy`); reuse a uuid schema for `topicCheckId` (mirror
`topic-checks/schemas.ts` `topicCheckIdSchema`).

#### 3. Record-review Server Action

**File**: `src/features/review/actions/rate-topic-check.ts` (new, `'use server'`)

**Intent**: The one mutation that closes the loop. Re-fetch the card (server-trusted), compute
the next FSRS state, persist atomically via the RPC, revalidate the queue.

**Contract**: `rateTopicCheck(topicCheckId: string, rating: unknown): Promise<ActionResultT>`.
Validate both inputs (return early on failure). Fetch the `topic_checks` row by id via the
server client (RLS scopes ownership; a missing/again-not-owned row → error result). Compute
`const card = applyRating(row, parsedRating, new Date())`. Call the RPC:
`supabase.rpc('record_review', { p_topic_check_id, p_rating, p_card: serialize(card) })` where
`serialize` emits the jsonb the RPC expects (Dates → ISO strings). Normalize the `{error}`
envelope like `runTableAction` (log on error, return `{success:false,error}`). On success
`revalidatePath('/review')` and `revalidatePath('/dashboard')`, return `{success:true}`. Never
send `user_id`.

### Success Criteria:

#### Automated Verification:

- Unit test for `scheduling.ts`: a New card rated Good yields `due` in the future, `reps`
  incremented, `state` advanced; rated Again yields a sooner `due` than Good. (`src/__tests__/`)
- Unit test: `previewIntervals` returns four distinct future dates ordered
  Again ≤ Hard ≤ Good ≤ Easy for a New card.
- `pnpm test` passes; `pnpm typecheck`/`pnpm lint` pass.

#### Manual Verification:

- (Deferred to Phase 3 — no UI yet to exercise the action by hand.)

**Implementation Note**: Pause for human confirmation after automated verification before Phase 3.

---

## Phase 3: /review session UI

### Overview

Build the `/review` Server Component (sequential one-card queue), the client rating island with
Anki-style interval previews, the "All caught up" empty state, and the dashboard entry link.

### Changes Required:

#### 1. Review route

**File**: `src/app/(protected)/review/page.tsx` (new)

**Intent**: Server Component that drives the sequential session. Fetch due checks, render the
first one with its previews; rely on `revalidatePath` to advance.

**Contract**: `const due = await getTopicChecksDue()`. If empty → render the "All caught up"
empty state (with a link back to `/dashboard`). Otherwise take `due[0]`, compute
`previewIntervals(due[0], new Date())`, and render the question + a `<RatingButtons>` island,
passing `topicCheckId`, the four preview dates (pre-formatted to human strings server-side), and
optionally `remaining: due.length`. Server-rendered Shiki for any markdown in the prompt reuses
`src/components/markdown/render-markdown` (server-only), matching S-01/S-02. Add `loading.tsx`
for the route per App-Router convention.

#### 2. Rating buttons island

**File**: `src/features/review/rating-buttons.tsx` (new, `'use client'`)

**Intent**: Four buttons (Again/Hard/Good/Easy), each showing its predicted interval; clicking
calls the Server Action and shows a pending state.

**Contract**: `PropsT = { topicCheckId: string; previews: Record<1|2|3|4, string> }`. Each button
labelled `"<grade> · <interval>"`. On click, call `rateTopicCheck(topicCheckId, grade)` inside a
transition (`useTransition`) for the pending/disabled state; on `{success:false}` surface the
error inline. No `useEffect`. Buttons stay usable at ~360px (NFR) — wrap/stack on narrow widths.

#### 3. Dashboard entry point

**File**: `src/app/(protected)/dashboard/page.tsx` (edit — minimal)

**Intent**: Make "Due today" actionable — link the stat (or add a "Review" button) to `/review`.

**Contract**: Wrap the "Due today" `StatCard` in a `Link href="/review"` (or add a `Button asChild`
linking there). Smallest possible change to S-04's layout — no restructure.

### Success Criteria:

#### Automated Verification:

- `pnpm build` succeeds (route compiles, client/server boundary correct).
- `pnpm typecheck`/`pnpm lint` pass.

#### Manual Verification:

- With a due check present, `/review` shows the question + four buttons each with an interval
  preview; the previews differ per grade.
- Rating a check advances to the next due check; when none remain, "All caught up" shows.
- The rating action feels instant — no multi-second wait (NFR).
- `/review` is usable down to ~360px (NFR).
- Dashboard "Due today" links to `/review`.

**Implementation Note**: Pause for human confirmation after automated verification before Phase 4.

---

## Phase 4: Fill the S-04 dashboard data seam

### Overview

Replace the dummy `getDashboardData` body with real per-user queries: due count, current
streak, and per-day review activity.

### Changes Required:

#### 1. Review-activity + streak read helpers

**File**: `src/features/review-events/queries.ts` (edit)

**Intent**: Provide the review-history reads the dashboard needs, owned by the review-events
feature (not the dashboard feature). Injectable client per the lessons.md isolation rule.

**Contract**: Add `getReviewActivity(client?): Promise<ActivityDayT[]>` — group `review_events`
**by a single app timezone, not UTC** (F5): bucket on `(reviewed_at at time zone APP_TIME_ZONE)::date`,
count per day; shape matches `ActivityDayT` (`{ date: 'YYYY-MM-DD', count }`). `APP_TIME_ZONE` is a
new IANA-string constant (e.g. `'Europe/Warsaw'`) co-located in `src/features/dashboard/constants.ts`
beside the existing `MS_PER_DAY`/`HEAT_LEVELS` (single-user personal tool — one zone is correct and
simplest; Vercel functions run in UTC, so naive `::date` / `new Date()` would bucket late-night reviews
into the next day). Add
`getCurrentStreak(activity: ActivityDayT[]): number` — **pure and synchronous**: consecutive days
ending today with ≥1 review, derived from the already-fetched `getReviewActivity()` series (no
second DB query, no client param). "Today" here is the current date **in `APP_TIME_ZONE`** (same
zone the activity is bucketed by), not the server's UTC date. Reuse `ActivityDayT` from
`features/dashboard/types.ts` (cross-feature type already shared there).

#### 2. Due count helper

**File**: `src/features/topic-checks/queries.ts` (edit)

**Intent**: A count for the "Due today" stat without over-fetching rows.

**Contract**: Add `getDueCount(client?): Promise<number>` using a `head:true, count:'exact'`
select with the same `due_at <= now()` filter as `getTopicChecksDue`. (Update the now-stale
comment block in this file that says nothing writes `due_at` — S-03 does now.)

#### 3. Wire the seam

**File**: `src/features/dashboard/data.ts` (edit)

**Intent**: Replace the dummy body (and its `TODO(S-03 data wiring)`) with real composition.

**Contract**: `getDashboardData` fetches the two independent reads in parallel
(`const [dueToday, activity] = await Promise.all([getDueCount(), getReviewActivity()])`), then
derives `const currentStreak = getCurrentStreak(activity)` from the already-fetched series, and
returns `{ dueToday, currentStreak, activity }`. Keep `DashboardDataT` unchanged (S-04 contract).
Remove the dummy generator. **Align the heatmap's `today`** (F5): the dashboard page currently
passes `buildHeatmapMatrix(data.activity, { today: new Date(), … })` — change that `today` to the
current date computed in `APP_TIME_ZONE` so the grid's "today" column matches the zone the activity
and streak use. Smallest possible edit to S-04's page; no heatmap-component change.

### Success Criteria:

#### Automated Verification:

- `pnpm build`/`pnpm typecheck`/`pnpm lint` pass.
- `getDashboardData` no longer imports the dummy generator (grep clean).

#### Manual Verification:

- After one review, the dashboard "Due today" count drops accordingly, streak reads 1, and the
  heatmap marks today (matches PRD Success Criteria: "heatmap shows the day, streak counter
  reads 1").
- Heatmap/streak remain correct after multiple reviews across the queue.

**Implementation Note**: Pause for human confirmation after automated verification before Phase 5.

---

## Phase 5: End-to-end test

### Overview

A Playwright spec covering the full loop plus cross-user RLS isolation, on the shared harness.

### Changes Required:

#### 1. Review E2E spec

**File**: `e2e/review.spec.ts` (new)

**Intent**: Prove the loop end-to-end and that the schedule/event actually change.

**Contract**: Use `e2e/helpers.ts` (`signUp`, `uniqueEmail`, `fillEditor`, `clientFor`). Flow:
sign up → create a note → attach a topic check → open `/review` → assert the question shows with
four interval-previewed buttons → rate Good → assert the check leaves the queue ("All caught up"
or next card) → via a `signInWithPassword` `clientFor` client assert a `review_events` row exists
for that check and `topic_checks.due_at` is now in the future. RLS test: a second user opening
`/review` sees none of user 1's checks; calling the rate path against user 1's id writes nothing
(0 rows). Treat the known local-GoTrue sign-up flake as environmental (lessons.md) — don't add
new retries outside the shared `signUp` chokepoint.

### Success Criteria:

#### Automated Verification:

- `pnpm test:e2e` passes for `review.spec.ts` (prod build + system Chrome harness).
- Existing specs still pass (no regression from the dashboard `data.ts` swap or the migration).

#### Manual Verification:

- Run the suite twice after `supabase db reset` to confirm stability against the sign-up flake.

**Implementation Note**: Final phase — after this, run `/10x-impl-review`.

---

## Testing Strategy

### Unit Tests (Vitest, `src/__tests__/`):

- `scheduling.ts`: New-card rating outcomes (Good → future due, reps++, state advances; Again →
  sooner than Good); `previewIntervals` returns four ordered distinct dates; row↔Card
  serialization round-trips dates correctly.

### Integration / E2E (Playwright):

- Full loop (create → review → rate → reschedule + event recorded).
- Cross-user RLS isolation on the review path.

### Manual Testing Steps:

1. Sign up, create a note, attach a topic check.
2. Open `/review`; confirm four buttons with distinct interval previews.
3. Rate Good; confirm advance / "All caught up"; confirm dashboard due-count drops, streak = 1,
   heatmap marks today.
4. Resize to ~360px; confirm the review screen stays usable.

## Performance Considerations

- The loop is one RPC round-trip + a revalidate per rating — meets the "feels instant" NFR.
- `getDueCount` uses `head:true, count:'exact'` (no row payload). `getReviewActivity` aggregates
  small per-user volumes — fine for MVP; revisit if a user accumulates very large histories
  (same family as S-01's deferred pagination follow-up).
- ts-fsrs computation is negligible; a single shared `fsrs()` instance avoids re-init per call.

## Migration Notes

- No data backfill — S-03 is the first writer of scheduling state; existing local rows become
  fresh New cards under the empty-card defaults. Drop of SM-2 columns is safe (no readers write
  them; `select('*')` readers adapt after typegen).
- `review_events.rating` constraint tightens `0–5 → 1–4`; no existing prod rows. Local test rows
  cleared by `supabase db reset`.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-03, north star).
- PRD: FR-016–019, US-01, Business Logic, `context/foundation/prd.md`.
- ts-fsrs docs: Context7 `/open-spaced-repetition/ts-fsrs` (`repeat`/`next`/`Rating`/`Card`).
- Schema baseline: `supabase/migrations/20260603070945_init_notes_topic_checks_review_events.sql`.
- RPC precedent: `supabase/migrations/20260603092554_add_delete_account_rpc.sql`.
- Write wrapper: `src/lib/supabase/run-table-action.ts`. Due helper:
  `src/features/topic-checks/queries.ts`. Dashboard seam: `src/features/dashboard/data.ts`.
- Lessons: Playwright `signInWithPassword` client + `pg_catalog` schema checks +
  local-GoTrue flake (`context/foundation/lessons.md`).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema migration + ts-fsrs dependency + typegen

#### Automated

- [x] 1.1 Migration applies cleanly (`supabase db reset`)
- [x] 1.2 `record_review` exists and is SECURITY INVOKER (verify via `pg_proc`)
- [x] 1.3 `topic_checks` has FSRS columns, lacks SM-2 columns (verify via `pg_attribute`)
- [x] 1.4 `review_events` rating check is `1..4` (verify via `pg_constraint`)
- [x] 1.5 Typegen regenerated; `pnpm typecheck`/`pnpm build` pass
- [x] 1.6 `pnpm lint` passes

#### Manual

- [ ] 1.7 `pnpm build` succeeds (ts-fsrs resolves, no `ERR_PNPM_IGNORED_BUILDS`)

### Phase 2: FSRS scheduling module + review write path

#### Automated

- [ ] 2.1 Unit test: New card Good → future due/reps++/state advances; Again sooner than Good
- [ ] 2.2 Unit test: `previewIntervals` returns four distinct ordered future dates
- [ ] 2.3 `pnpm test`/`pnpm typecheck`/`pnpm lint` pass

### Phase 3: /review session UI

#### Automated

- [ ] 3.1 `pnpm build` succeeds (route + client/server boundary)
- [ ] 3.2 `pnpm typecheck`/`pnpm lint` pass

#### Manual

- [ ] 3.3 `/review` shows question + four buttons with distinct interval previews
- [ ] 3.4 Rating advances to next card; empty queue shows "All caught up"
- [ ] 3.5 Rating feels instant (NFR)
- [ ] 3.6 `/review` usable at ~360px (NFR)
- [ ] 3.7 Dashboard "Due today" links to `/review`

### Phase 4: Fill the S-04 dashboard data seam

#### Automated

- [ ] 4.1 `pnpm build`/`pnpm typecheck`/`pnpm lint` pass
- [ ] 4.2 `getDashboardData` no longer imports the dummy generator (grep clean)

#### Manual

- [ ] 4.3 After one review: due-count drops, streak = 1, heatmap marks today
- [ ] 4.4 Heatmap/streak correct after multiple reviews

### Phase 5: End-to-end test

#### Automated

- [ ] 5.1 `pnpm test:e2e` passes for `review.spec.ts`
- [ ] 5.2 Existing specs still pass (no regression)

#### Manual

- [ ] 5.3 Suite stable across two runs after `supabase db reset`
