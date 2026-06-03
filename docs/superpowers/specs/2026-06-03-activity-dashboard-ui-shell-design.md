# Activity Dashboard UI Shell — Design

**Date:** 2026-06-03
**Roadmap slice:** S-04 `activity-dashboard` (FR-020, FR-021, FR-022)
**Status:** design approved, pre-plan

## What this is (and is not)

A **UI-only shell** for the S-04 activity dashboard, built ahead of its data dependency
against **dummy data**. S-04's roadmap prerequisite is S-03 (`close-recall-loop`) — but
that dependency is purely a _data_ dependency: the dashboard reads `review_events`, which
don't exist until the recall loop writes them. Building the presentation layer now against
a typed mock severs exactly that one dependency and nothing else.

**This is a spike, not the slice.** It does NOT:

- run any Supabase query, migration, or RLS work,
- compute real streak / due-today / activity aggregates,
- close out S-04 — the roadmap entry and Linear EX-364 stay `proposed`/Backlog until the
  real data wiring lands (after S-03).

It is tracked as its own scoped change (e.g. `activity-dashboard-ui`), built in an isolated
worktree, and merged independently of the in-flight S-02 work.

## Why it doesn't collide with S-02

Disjoint by construction (feature-first layout):

- **S-02 (`attach-topic-checks`) touches:** `src/features/topic-checks/`, the note detail
  route `src/app/(protected)/notes/[id]/page.tsx`.
- **This shell touches:** a new `src/features/dashboard/`, the dashboard route
  `src/app/(protected)/dashboard/page.tsx` (currently a placeholder explicitly marked
  _"real dashboard is S-04"_), and `src/app/globals.css` (theme tokens).
- **Only cross-cutting file:** `globals.css`. S-02 is very unlikely to touch it, but it is
  the one merge-conflict surface to watch.

## Composition (approved visually)

Single column, max-width ~780px, inside the existing `(protected)` layout:

```
┌──────────────────────┬──────────────────────┐
│ DUE TODAY            │ CURRENT STREAK        │   ← stat cards, grid 1fr 1fr
│ 7                   │ 🔥 12 days            │     stack to 1 col below ~440px (sm:)
│ topic checks …      │ consecutive days …    │
├──────────────────────┴──────────────────────┤
│ Review activity — last 12 months            │   ← heatmap card
│ JUN JUL AUG … MAY                            │
│ ▦▦▦▦▦▦▦▦▦▦▦▦▦  (7 rows × ~53 cols)            │
│ Less ▢▦▦▦■ More                              │
└──────────────────────────────────────────────┘
```

## Heatmap (the centerpiece)

- **Shape:** GitHub-style contribution grid. Rows = weekday (7), columns = ISO weeks,
  `grid-auto-flow: column`. ~53 columns = trailing 12 months ending today.
- **Cells:** 11px square, 2px gap, 2px radius, `box-sizing: border-box` on every cell
  (the empty/filled size bug we hit came from a bordered empty cell in `content-box` —
  no per-cell borders; distinction is background only).
- **Buckets:** 5-step grayscale ramp, count → level:
  - `0 → l0`, `1–2 → l1`, `3–5 → l2`, `6–9 → l3`, `10+ → l4`.
  - These thresholds are a first guess; note for the wiring slice to re-tune against the
    real review-count distribution.
- **Layout logic (build it correctly now — reused with real data):** given
  `{ date, count }[]`, build a 7×N matrix. Each day lands at
  `row = dayOfWeek(date)`, `column = weeksSinceStart(date)`; pad leading cells of the first
  column so weekday alignment is correct. Month labels sit above the column where the month
  first changes.
- **Hover:** single lightweight floating tooltip (one element, mouse-driven) — NOT one
  Radix tooltip per cell (≈371 cells). Shows `"N reviews · Mon, Jun 3, 2025"`, empty days
  `"No reviews · …"`. Hovered cell gets a `--foreground` (white) outline.
- **Responsive:** card body is `overflow-x-auto`; the grid keeps its natural ~690px width
  and scrolls horizontally below that. Satisfies the FR's ~360px mobile floor.

## Palette — global theme shift (approved)

Edit the `.dark` block in `src/app/globals.css` so the **whole app** adopts a blacker
palette. Current → new:

| token                | current (shadcn)     | new                  |
| -------------------- | -------------------- | -------------------- |
| `--background`       | `oklch(0.145 0 0)`   | `oklch(0.08 0 0)`    |
| `--card`             | `oklch(0.205 0 0)`   | `oklch(0.135 0 0)`   |
| `--border`           | `oklch(1 0 0 / 10%)` | `oklch(1 0 0 / 14%)` |
| `--foreground`       | `oklch(0.985 0 0)`   | unchanged            |
| `--muted-foreground` | `oklch(0.708 0 0)`   | unchanged            |

> **Blast radius:** this re-skins auth pages, notes, and settings, not just the dashboard.
> Requires a quick visual pass on those surfaces to confirm nothing regresses (contrast,
> card legibility). All tokens stay zero-chroma neutral — there is no blue in shadcn's dark
> theme; the blue tint in early mockups was hand-picked hex, now discarded.

Heatmap ramp values (tuned against the darker card; define as local constants or
`--heat-0..4` vars in `globals.css`):
`l0 oklch(0.21)`, `l1 oklch(0.36)`, `l2 oklch(0.53)`, `l3 oklch(0.74)`, `l4 oklch(0.985)`.

## Architecture (feature-first)

New feature `src/features/dashboard/`:

- **`types.ts`**
  - `ActivityDay = { date: string /* YYYY-MM-DD */; count: number }`
  - `DashboardData = { dueToday: number; currentStreak: number; activity: ActivityDay[] }`
- **`data.ts`** — `getDashboardData(): Promise<DashboardData>`. **Returns dummy data now**,
  clearly marked as spike scaffolding. This is the single seam where real Supabase queries
  drop in post-S-03 (aggregate `review_events` by day for `activity`; count due
  `topic_checks` for `dueToday`; compute consecutive-day streak for `currentStreak`).
  Keeping the return type the real shape is the anti-rework discipline: wiring later is a
  body swap, not a component rewrite.
- **`components/stat-card.tsx`** — presentational: `{ label, value, sub }`. Server-safe.
- **`components/activity-heatmap.tsx`** — `'use client'` (owns the hover tooltip). Pure
  presentation: takes `ActivityDay[]`, builds the matrix, renders grid + month labels +
  legend. No data fetching.
- **`lib/build-heatmap-matrix.ts`** (feature-local) — the date→matrix layout function,
  unit-testable in isolation.

Route: `src/app/(protected)/dashboard/page.tsx` — replace the placeholder. Server Component:
`const data = await getDashboardData()` → renders two `StatCard`s + `ActivityHeatmap`.
Stays thin, imports from the feature.

Data flows server → client as serializable props (`ActivityDay[]`, numbers). Clean boundary:
the page computes/sources data, the heatmap only renders and handles hover.

## Testing

- **Unit (Vitest):** `build-heatmap-matrix` — correct weekday alignment, leading-cell
  padding, count→bucket mapping, month-label placement.
- **E2E (Playwright, `e2e/dashboard.spec.ts`):** sign in → visit `/dashboard` → assert both
  stat cards render, the grid renders the expected cell count, and a hover surfaces the
  tooltip. Follows the project's existing e2e convention (local Supabase up, prod build).

## Out of scope (YAGNI)

Real queries / SM-2 / `due_at` computation / streak computation (the `data.ts` seam),
month-navigation / paging, light theme, deep a11y pass on the tooltip (note: real wiring
slice must add an accessible name / keyboard path), zero-review empty state (dummy always
has data — flag for the wiring slice).

## Process notes

- Open as a scoped change via `/10x-new activity-dashboard-ui` (NOT S-04 proper).
- Build in an isolated worktree off local `HEAD` (origin is stale); `cp .env.local` into the
  worktree before any build/E2E (it's gitignored, not copied).
- Do **not** flip roadmap S-04 → done or move EX-364; this is a UI spike feeding the later
  data-wiring slice.
