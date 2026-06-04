# Goal-hit Congrats Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a confetti congrats dialog the moment a review pushes the user's daily or weekly review count across its goal threshold.

**Architecture:** The rate action (`rateTopicCheck`) is the only place counts change, so it detects the crossing server-side (before/after counts vs goal) and returns a `celebrate` payload. The review page reads the goal (route-join, like the dashboard) and passes it down. A React Context provider rendered outside the card conditional owns the celebration state + dialog so it survives the last-card unmount; it fires `canvas-confetti` on trigger.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), React 19, TypeScript, Tailwind v4, shadcn `Dialog` (radix-ui), Supabase, Vitest, `canvas-confetti`.

---

## Context the implementer needs

- **pnpm only** (never npm/npx). Lockfile is `pnpm-lock.yaml`.
- **No `useEffect`** (project rule) — the dialog trigger is event-driven (set in the action-result callback).
- **Types** suffixed `T`; prefer `type` over `interface`; component files export only the component (co-located `PropsT` OK).
- **Path alias** is `@/` → `src/`.
- **Counting semantics differ per bar** and the dialog must match them:
  - daily = **distinct cards** reviewed today (zone-bucketed) → `getReviewedTodayCount()`.
  - weekly = **total review events** in the last 7 days (`today − 6d`, zone-bucketed) → new `getReviewsThisWeekCount()`. Mirrors `src/features/dashboard/stats.ts:77,84`.
- `features/review → features/review-events` is an established cross-feature pattern (`features/dashboard/data.ts` already imports `getReviewedTodayCount` etc.), so importing the count queries into the action is allowed.
- `useActionTransition.run` currently returns `Promise<ActionResultT>`; we make it generic so the rating island gets the `celebrate` field typed without touching the shared `ActionResultT`.
- Test files are flat in `src/__tests__/*.test.ts` (Vitest). Run a single file with `pnpm test <path>`.

## File structure (what each unit owns)

- `src/features/review/types.ts` **(new)** — `GoalCelebrationT` (the dialog payload) + `RateResultT` (action return contract). One concern: review-action shared types.
- `src/features/review/detect-goal-crossing.ts` **(new)** — pure crossing math. No I/O, unit-tested.
- `src/features/review-events/queries.ts` **(modify)** — add `getReviewsThisWeekCount()`.
- `src/features/review/schemas.ts` **(modify)** — add `goalSchema`.
- `src/features/review/actions/rate-topic-check.ts` **(modify)** — accept `goal`, read before/after counts, return `celebrate`.
- `src/hooks/use-action-transition.ts` **(modify)** — make `run` generic.
- `src/features/review/review-celebration-context.tsx` **(new)** — provider + `useReviewCelebration` hook + confetti; renders the dialog.
- `src/features/review/goal-celebration-dialog.tsx` **(new)** — presentational dialog.
- `src/features/review/rating-buttons.tsx` **(modify)** — accept `goal`, trigger celebration.
- `src/app/(protected)/review/page.tsx` **(modify)** — read goal, wrap body in provider, pass `goal`.
- `src/__tests__/goal-crossing.test.ts` **(new)** — unit tests for the pure helper.
- `package.json` **(modify)** — `canvas-confetti` + `@types/canvas-confetti`.

> **Testing scope note:** Per the project's per-slice review gate (CLAUDE.md), the E2E layer is authored AFTER review + `/simplify`, against the cleaned-up code. This plan therefore unit-tests the pure helper now (TDD) and relies on `pnpm typecheck`/`lint`/`build` for the wiring; the Playwright E2E for the dialog is deferred to the slice gate, not written here.

---

### Task 1: Add the confetti dependency

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
pnpm add canvas-confetti && pnpm add -D @types/canvas-confetti
```

- [ ] **Step 2: Verify it resolved**

Run: `pnpm ls canvas-confetti`
Expected: prints `canvas-confetti <version>` (no error).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add canvas-confetti for goal-hit celebration"
```

---

### Task 2: Celebration types

**Files:**

- Create: `src/features/review/types.ts`

- [ ] **Step 1: Create the types file**

```ts
import type { ActionResultT } from '@/types/action'

// Payload describing a goal crossing detected during a single review rating. `daily`/`weekly`
// flag which goal was crossed by THIS rating (both can be true → one combined dialog). The
// counts are post-rating, for the "20/20" copy.
export type GoalCelebrationT = {
  daily: boolean
  weekly: boolean
  dailyCount: number
  weeklyCount: number
  dailyGoal: number
  weeklyGoal: number
}

// rateTopicCheck's return contract: the shared action envelope plus an optional celebration.
// A superset of ActionResultT (the shared type is untouched); `celebrate` is present only when
// a goal was crossed.
export type RateResultT = ActionResultT & { celebrate?: GoalCelebrationT }
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/features/review/types.ts
git commit -m "feat(review): add GoalCelebrationT + RateResultT types"
```

---

### Task 3: Pure crossing helper (TDD)

**Files:**

- Test: `src/__tests__/goal-crossing.test.ts`
- Create: `src/features/review/detect-goal-crossing.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { detectGoalCrossing } from '@/features/review/detect-goal-crossing'

// goal=5 → weeklyGoal=35. Helper returns undefined when nothing crossed, else the payload.
const base = { dailyBefore: 0, dailyAfter: 0, weeklyBefore: 0, weeklyAfter: 0, dailyGoal: 5 }

describe('detectGoalCrossing', () => {
  it('returns undefined when neither goal is crossed', () => {
    expect(
      detectGoalCrossing({
        ...base,
        dailyBefore: 2,
        dailyAfter: 3,
        weeklyBefore: 2,
        weeklyAfter: 3,
      }),
    ).toBeUndefined()
  })

  it('flags a daily-only crossing (4 → 5)', () => {
    const r = detectGoalCrossing({
      ...base,
      dailyBefore: 4,
      dailyAfter: 5,
      weeklyBefore: 10,
      weeklyAfter: 11,
    })
    expect(r).toEqual({
      daily: true,
      weekly: false,
      dailyCount: 5,
      weeklyCount: 11,
      dailyGoal: 5,
      weeklyGoal: 35,
    })
  })

  it('flags a weekly-only crossing (34 → 35)', () => {
    const r = detectGoalCrossing({
      ...base,
      dailyBefore: 6,
      dailyAfter: 7,
      weeklyBefore: 34,
      weeklyAfter: 35,
    })
    expect(r).toEqual({
      daily: false,
      weekly: true,
      dailyCount: 7,
      weeklyCount: 35,
      dailyGoal: 5,
      weeklyGoal: 35,
    })
  })

  it('flags both when one rating crosses both (combined dialog)', () => {
    const r = detectGoalCrossing({
      ...base,
      dailyBefore: 4,
      dailyAfter: 5,
      weeklyBefore: 34,
      weeklyAfter: 35,
    })
    expect(r?.daily).toBe(true)
    expect(r?.weekly).toBe(true)
  })

  it('does not re-fire daily when already at/over goal (re-review keeps count flat)', () => {
    expect(
      detectGoalCrossing({
        ...base,
        dailyBefore: 5,
        dailyAfter: 5,
        weeklyBefore: 5,
        weeklyAfter: 5,
      }),
    ).toBeUndefined()
  })

  it('does not fire daily when already over goal (5 → 6)', () => {
    expect(
      detectGoalCrossing({
        ...base,
        dailyBefore: 5,
        dailyAfter: 6,
        weeklyBefore: 5,
        weeklyAfter: 6,
      }),
    ).toBeUndefined()
  })

  it('guards goal <= 0', () => {
    expect(
      detectGoalCrossing({
        dailyBefore: 0,
        dailyAfter: 1,
        weeklyBefore: 0,
        weeklyAfter: 1,
        dailyGoal: 0,
      }),
    ).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/goal-crossing.test.ts`
Expected: FAIL — cannot resolve `@/features/review/detect-goal-crossing`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { GoalCelebrationT } from '@/features/review/types'

// Pure crossing detector. A goal is "crossed" by this rating when the count went from below
// the goal to at/above it (before < goal <= after) — so it fires exactly once and never on a
// re-review that leaves the distinct-card count flat. weeklyGoal is dailyGoal * 7 (matches the
// dashboard weekly bar). Returns undefined when nothing crossed so the action omits `celebrate`.
export function detectGoalCrossing(input: {
  dailyBefore: number
  dailyAfter: number
  weeklyBefore: number
  weeklyAfter: number
  dailyGoal: number
}): GoalCelebrationT | undefined {
  const { dailyBefore, dailyAfter, weeklyBefore, weeklyAfter, dailyGoal } = input
  if (dailyGoal <= 0) return undefined
  const weeklyGoal = dailyGoal * 7
  const daily = dailyBefore < dailyGoal && dailyAfter >= dailyGoal
  const weekly = weeklyBefore < weeklyGoal && weeklyAfter >= weeklyGoal
  if (!daily && !weekly) return undefined
  return { daily, weekly, dailyCount: dailyAfter, weeklyCount: weeklyAfter, dailyGoal, weeklyGoal }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/goal-crossing.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/goal-crossing.test.ts src/features/review/detect-goal-crossing.ts
git commit -m "feat(review): pure detectGoalCrossing helper + tests"
```

---

### Task 4: Weekly review-count query

**Files:**

- Modify: `src/features/review-events/queries.ts`

- [ ] **Step 1: Add the query**

Append this function to `src/features/review-events/queries.ts` (the file already imports `isoDateInZone`, `APP_TIME_ZONE`, `MS_PER_DAY`, `runTableQuery`, `createClient`, and the `SupabaseClient`/`Database` types):

```ts
// Total review events in the trailing 7 days (today − 6d, zone-bucketed) — the same window the
// dashboard's weekly goal bar uses (stats.ts reviewsThisWeek). Counts EVENTS, not distinct cards
// (a card reviewed twice counts twice), matching that bar. Over-fetches an 8-day buffer to dodge
// the UTC-vs-Warsaw midnight skew, then filters by zone date. Injectable client per the isolation
// rule. RLS scopes rows to the owner.
export async function getReviewsThisWeekCount(client?: SupabaseClient<Database>): Promise<number> {
  const supabase = client ?? (await createClient())
  const since = new Date(Date.now() - 8 * MS_PER_DAY).toISOString()
  const rows = await runTableQuery(supabase, (c) =>
    c.from('review_events').select('reviewed_at').gte('reviewed_at', since),
  )
  const weekStart = isoDateInZone(new Date(Date.now() - 6 * MS_PER_DAY), APP_TIME_ZONE)
  return rows.filter((r) => isoDateInZone(new Date(r.reviewed_at), APP_TIME_ZONE) >= weekStart)
    .length
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/review-events/queries.ts
git commit -m "feat(review-events): add getReviewsThisWeekCount"
```

---

### Task 5: goalSchema

**Files:**

- Modify: `src/features/review/schemas.ts`

- [ ] **Step 1: Append the schema**

Add to `src/features/review/schemas.ts` (file already imports `z`):

```ts
// The daily goal crossing the Server-Action boundary. It's route-joined from a trusted server
// read but arrives via the client island, so we still validate shape. Coerce because action args
// arrive loosely typed. No upper bound needed here — it's cosmetic (gates a congrats dialog).
export const goalSchema = z.coerce.number().int().min(1)
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/review/schemas.ts
git commit -m "feat(review): add goalSchema for the rate action"
```

---

### Task 6: Make useActionTransition generic

**Files:**

- Modify: `src/hooks/use-action-transition.ts`

- [ ] **Step 1: Generalize `run`**

Replace the `run` function (lines 19-32) with this generic version. Only the signature and the inner `Promise<T>` change; the body is otherwise identical:

```ts
function run<T extends ActionResultT>(
  action: () => Promise<T>,
  opts?: { successMessage?: string },
): Promise<T> {
  setError(undefined)
  return new Promise<T>((resolve) => {
    startTransition(async () => {
      const result = await action()
      if (!result.success) setError(result.error)
      toastResult(result, opts?.successMessage)
      resolve(result)
    })
  })
}
```

- [ ] **Step 2: Typecheck (existing callers must still compile)**

Run: `pnpm typecheck`
Expected: PASS — existing callers infer `T = ActionResultT`, so no call sites change.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-action-transition.ts
git commit -m "refactor(hooks): make useActionTransition.run generic over the result type"
```

---

### Task 7: Detect crossing inside rateTopicCheck

**Files:**

- Modify: `src/features/review/actions/rate-topic-check.ts`

- [ ] **Step 1: Update imports**

Add these imports to the top of the file (alongside the existing ones):

```ts
import { detectGoalCrossing } from '@/features/review/detect-goal-crossing'
import { goalSchema } from '@/features/review/schemas'
import type { RateResultT } from '@/features/review/types'
import { getReviewedTodayCount, getReviewsThisWeekCount } from '@/features/review-events/queries'
```

- [ ] **Step 2: Change the signature + return type**

Change the function declaration from:

```ts
export async function rateTopicCheck(
  topicCheckId: string,
  rating: unknown,
): Promise<ActionResultT> {
```

to:

```ts
export async function rateTopicCheck(
  topicCheckId: string,
  rating: unknown,
  goal: unknown,
): Promise<RateResultT> {
```

(`ActionResultT` is still imported and used by the early-return error branches — leave that import.)

- [ ] **Step 3: Read before-counts alongside the row fetch**

Replace the supabase-client + row-fetch block:

```ts
const supabase = await createClient()
const { data: row, error: fetchError } = await supabase
  .from('topic_checks')
  .select('*')
  .eq('id', parsedId.data)
  .maybeSingle()
```

with (parallel reads using the same client):

```ts
const supabase = await createClient()
// Goal is cosmetic (gates the congrats dialog), so a bad value must never fail the rating —
// fall back to 0, which makes detectGoalCrossing return undefined (no celebration).
const goalParsed = goalSchema.safeParse(goal)
const dailyGoal = goalParsed.success ? goalParsed.data : 0

const [{ data: row, error: fetchError }, dailyBefore, weeklyBefore] = await Promise.all([
  supabase.from('topic_checks').select('*').eq('id', parsedId.data).maybeSingle(),
  getReviewedTodayCount(supabase),
  getReviewsThisWeekCount(supabase),
])
```

- [ ] **Step 4: Compute crossing after the RPC and return it**

Replace the tail of the function:

```ts
  revalidatePath('/review')
  revalidatePath('/dashboard')
  return { success: true }
}
```

with:

```ts
  const [dailyAfter, weeklyAfter] = await Promise.all([
    getReviewedTodayCount(supabase),
    getReviewsThisWeekCount(supabase),
  ])
  const celebrate = detectGoalCrossing({
    dailyBefore,
    dailyAfter,
    weeklyBefore,
    weeklyAfter,
    dailyGoal,
  })

  revalidatePath('/review')
  revalidatePath('/dashboard')
  return { success: true, celebrate }
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: FAIL at the call site in `rating-buttons.tsx` (now 2 args, needs 3) — that's fixed in Task 10. All other files PASS. (If you want a clean checkpoint, proceed to Tasks 8-10 before re-running.)

- [ ] **Step 6: Commit**

```bash
git add src/features/review/actions/rate-topic-check.ts
git commit -m "feat(review): detect daily/weekly goal crossing in rateTopicCheck"
```

---

### Task 8: Celebration context provider (+ confetti)

**Files:**

- Create: `src/features/review/review-celebration-context.tsx`

- [ ] **Step 1: Create the provider, hook, and confetti trigger**

```tsx
'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import confetti from 'canvas-confetti'

import { GoalCelebrationDialog } from '@/features/review/goal-celebration-dialog'
import type { GoalCelebrationT } from '@/features/review/types'

type CelebrationContextT = { celebrate: (payload: GoalCelebrationT) => void }

const ReviewCelebrationContext = createContext<CelebrationContextT | undefined>(undefined)

// Owns the goal-celebration state ABOVE the review page's `card ? ... : empty` branch, so the
// dialog survives RatingButtons unmounting when the last due card is rated (which is exactly
// when the goal is most often crossed). `celebrate` is event-driven — confetti + open in one
// call, no useEffect.
export function ReviewCelebrationProvider({ children }: { children: ReactNode }) {
  const [celebration, setCelebration] = useState<GoalCelebrationT | undefined>(undefined)

  const celebrate = useCallback((payload: GoalCelebrationT) => {
    void confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
    setCelebration(payload)
  }, [])

  const value = useMemo(() => ({ celebrate }), [celebrate])

  return (
    <ReviewCelebrationContext value={value}>
      {children}
      <GoalCelebrationDialog celebration={celebration} onClose={() => setCelebration(undefined)} />
    </ReviewCelebrationContext>
  )
}

export function useReviewCelebration(): CelebrationContextT {
  const ctx = useContext(ReviewCelebrationContext)
  if (!ctx) throw new Error('useReviewCelebration must be used within ReviewCelebrationProvider')
  return ctx
}
```

> Note: React 19 allows `<Context value=...>` directly (no `.Provider`). If your editor flags it, use `<ReviewCelebrationContext.Provider value={value}>`.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: FAIL only for the not-yet-created `goal-celebration-dialog` import (fixed in Task 9) and the Task 7 call-site. Create Task 9 next.

- [ ] **Step 3: Commit (after Task 9 compiles — or commit together with Task 9)**

```bash
git add src/features/review/review-celebration-context.tsx
git commit -m "feat(review): celebration context provider + confetti trigger"
```

---

### Task 9: Presentational dialog

**Files:**

- Create: `src/features/review/goal-celebration-dialog.tsx`

- [ ] **Step 1: Create the dialog**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { GoalCelebrationT } from '@/features/review/types'

type PropsT = { celebration: GoalCelebrationT | undefined; onClose: () => void }

// Which goal(s) crossed → the headline.
function title(c: GoalCelebrationT): string {
  if (c.daily && c.weekly) return 'Daily + weekly goal hit!'
  if (c.weekly) return 'Weekly goal hit!'
  return 'Daily goal hit!'
}

// The count line under the headline.
function detail(c: GoalCelebrationT): string {
  const daily = `${c.dailyCount}/${c.dailyGoal} today`
  const weekly = `${c.weeklyCount}/${c.weeklyGoal} this week`
  if (c.daily && c.weekly) return `${daily} · ${weekly}`
  if (c.weekly) return weekly
  return daily
}

// Presentational congrats dialog. Controlled by the celebration payload from the provider; the
// provider fires confetti and owns open/close. neon-cyan title matches the dashboard goal bar.
export function GoalCelebrationDialog({ celebration, onClose }: PropsT) {
  return (
    <Dialog
      open={!!celebration}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        {celebration && (
          <>
            <DialogHeader>
              <DialogTitle className="text-neon-cyan">{title(celebration)} 🎉</DialogTitle>
              <DialogDescription>{detail(celebration)}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button>Nice!</Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: only the Task 7 call-site error remains (fixed in Task 10).

- [ ] **Step 3: Commit**

```bash
git add src/features/review/goal-celebration-dialog.tsx src/features/review/review-celebration-context.tsx
git commit -m "feat(review): goal-celebration dialog component"
```

---

### Task 10: Wire RatingButtons to trigger the celebration

**Files:**

- Modify: `src/features/review/rating-buttons.tsx`

- [ ] **Step 1: Update imports and props**

Add the hook import:

```ts
import { useReviewCelebration } from '@/features/review/review-celebration-context'
```

Change the props type:

```ts
type PropsT = { topicCheckId: string; previews: Record<number, string>; goal: number }
```

- [ ] **Step 2: Pass goal to the action and trigger on crossing**

Update the component body. Add the hook call near the top:

```ts
export function RatingButtons({ topicCheckId, previews, goal }: PropsT) {
  const { error, isPending, run } = useActionTransition()
  const { celebrate } = useReviewCelebration()
```

Change the `onClick` to pass `goal` and trigger the celebration from the resolved result:

```tsx
            onClick={() =>
              run(() => rateTopicCheck(topicCheckId, grade, goal), {
                successMessage: 'Review recorded',
              }).then((result) => {
                if (result.success && result.celebrate) celebrate(result.celebrate)
              })
            }
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS — `run` infers `T = RateResultT`, so `result.celebrate` is typed; the action call now has 3 args.

- [ ] **Step 4: Commit**

```bash
git add src/features/review/rating-buttons.tsx
git commit -m "feat(review): trigger goal celebration from the rating buttons"
```

---

### Task 11: Wire the review page (read goal, mount provider)

**Files:**

- Modify: `src/app/(protected)/review/page.tsx`

- [ ] **Step 1: Add imports**

```ts
import { ReviewCelebrationProvider } from '@/features/review/review-celebration-context'
import { getDailyGoal } from '@/features/settings/queries'
```

- [ ] **Step 2: Read the goal alongside the due queue**

Change:

```ts
const { first: card, count } = await getDueQueue()
```

to:

```ts
const [{ first: card, count }, goal] = await Promise.all([getDueQueue(), getDailyGoal()])
```

- [ ] **Step 3: Wrap the body in the provider and pass `goal`**

Wrap the existing `{!card ? (...) : (...)}` JSX inside `<PageShell>` with `<ReviewCelebrationProvider>`, and add `goal={goal}` to the `<RatingButtons>` usage. The `PageShell` content becomes:

```tsx
<ReviewCelebrationProvider>
  {!card ? (
    <Card className="text-center">
      <CardHeader>
        <CardTitle>All caught up 🎉</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <p className="text-muted-foreground text-sm">
          No topic checks are due right now. Come back when more are scheduled.
        </p>
        <Button asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  ) : (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Recall</CardTitle>
          {card.notes?.title && (
            <Link
              href={`/notes/${card.note_id}`}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              From: {card.notes.title}
            </Link>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <RenderMarkdown content={card.prompt} />
          {(card.example || card.code_context) && (
            <details className="border-t pt-3">
              <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm select-none">
                Show answer
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                {card.example && <RenderMarkdown content={card.example} />}
                {card.code_context && <RenderMarkdown content={card.code_context} />}
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <RatingButtons topicCheckId={card.id} previews={previews} goal={goal} />
    </>
  )}
</ReviewCelebrationProvider>
```

> Why wrap outside the `card` conditional: the provider (and thus the dialog + celebration state) must persist when rating the last card flips this to the "All caught up" branch and unmounts `RatingButtons`.

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(protected)/review/page.tsx"
git commit -m "feat(review): read daily goal and mount celebration provider on the review page"
```

---

### Task 12: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 3: Unit tests**

Run: `pnpm test`
Expected: PASS (includes `goal-crossing.test.ts`).

- [ ] **Step 4: Production build**

Run: `pnpm build`
Expected: PASS (confirms the new client/server boundary + canvas-confetti bundle).

- [ ] **Step 5: Manual smoke (optional but recommended)**

With the local Supabase stack up (`supabase start`) and `dev@example.com` / `password123`:
set a low daily goal in Settings, go to `/review`, rate cards until the count crosses the
goal, and confirm: confetti fires, the dialog shows the right copy/counts, closing dismisses
it, and crossing on the **last** due card still shows the dialog over "All caught up".

---

## Post-implementation (per project CLAUDE.md per-slice gate)

This plan stops at green typecheck/lint/unit/build. Before archiving, run the project's
review gate: the parallel review fan-out (`/10x-impl-review`, `/tailwind-v4-audit`,
`feature-first-structure`, `/module-cohesion-audit`), then `/simplify`, then author the
Playwright E2E for the dialog against the cleaned-up code, then `/10x-archive`.

Two specific things for the review fan-out to confirm:

- the `features/review → features/review-events` and route→`features/settings` imports match
  the documented precedents (they do — dashboard does both);
- the stray untracked `src/components/ui/goal-progress-bar.tsx` duplicate (out of scope here)
  gets cleaned up separately.
  </content>
