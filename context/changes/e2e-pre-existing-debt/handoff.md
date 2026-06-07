# Handoff — pre-existing E2E debt (unmasked by the F5 gate)

**Date:** 2026-06-07 · **Branch:** `main`

## TL;DR for next session

The F5 "stats consolidation" slice is **done, committed, and verified** (see below). While running its
review gate, the full E2E suite surfaced **5 failing specs that are pre-existing debt — none caused by
F5**. Two were already fixed (the "dumb string" tests). **Three remain. Fix them, then run the full
E2E suite once to confirm green.** Start straight away — context is below, no re-investigation needed.

## What's already DONE (committed on `main`, do not redo)

F5 — dashboard/memory-cards stats moved from fetch-whole-table-and-reduce-in-TS into 3 SECURITY
INVOKER Postgres RPCs (`review_day_counts`, `card_stats`, `card_overview`); the arbitrary 400-day
activity window is gone; streak/heatmap stay pure TS. Verified: `pnpm typecheck`, `pnpm lint`,
`pnpm test` (94/94), RLS scoping checked per-user via psql, and the overview DOM proved `card_overview`
returns correct counts.

Commits: `1762c5a` (consolidation), `be6a8f8` (Zod guards on RPC jsonb), `08af335` (extract+test
`nextReviewCounts`), `6a13c3f` (E2E `expectDashboard` — tolerant `/dashboard?toast=` match, killed the
auth-cascade flake 18→7), `a3f9c68` (de-brittled the dashboard + overview string assertions).
Migration `supabase/migrations/20260607095935_dashboard_stats_rpcs.sql` is applied locally
(`supabase db reset` already run).

## What REMAINS — 3 specs to fix (all pre-existing, not F5)

### 1. `e2e/memory-cards.spec.ts:34` — stale edit-URL pattern (deterministic) — QUICK

- **Symptom:** `expect(page).toHaveURL(/\?edit=[0-9a-f-]+/)` fails; actual URL is
  `/memory-cards/<id>/edit`.
- **Cause:** memory-card edit migrated from a `?edit=` query (notes still use that) to a dedicated
  route — `src/app/(protected)/memory-cards/[id]/edit/page.tsx` exists. The spec was never updated.
- **Fix:** line 34 → `await expect(page).toHaveURL(/\/memory-cards\/[0-9a-f-]+\/edit$/)`. Update the
  line-32 comment ("Edit via the ?edit link") to say the edit route. The Edit trigger
  (`row.getByRole('link', { name: 'Edit' })`, line 33) already navigates there — verify quickly.

### 2. `e2e/notes-subject-filter.spec.ts:37` — ambiguous locator (deterministic) — QUICK

- **Symptom:** `getByRole('link', { name: 'New note' }).click()` → strict-mode violation, **2 matches**
  (the `PageShell` action button + the `EmptyState` CTA, both `href="/notes/new?subject=<id>"`).
- **Cause:** the subject-filtered notes page renders two "New note" links. Intent (spec comment line 6)
  is just to reach `/notes/new?subject=<id>`.
- **Fix:** scope it — simplest is `.first()`; cleaner is to scope to the page header/PageShell actions
  region. Confirm both links carry the `?subject=` query (they do) so either is correct.

### 3. `memory-cards-listing.spec.ts:30`, `subjects.spec.ts:38`, `action-feedback-toasts.spec.ts:40` — 30s timeouts — INVESTIGATE

- **Symptom:** `Test timeout of 30000ms exceeded` in the **full** suite run.
- **Likely cause:** full-suite load — local GoTrue/stack degrades over a long run (documented in
  `context/foundation/lessons.md` + `AGENTS.md` Testing). These pass in smaller batches.
- **Action:** run each in isolation first (`pnpm test:e2e <spec>`). If green in isolation → load-only;
  decide whether to lower Playwright `workers` or raise per-action timeouts in the slow specs. If a
  spec fails in isolation too, it's a real bug — debug it then.

## How to work it

- Local Supabase must be up (`supabase status`); the F5 migration is already applied. E2E builds a
  fresh prod server on port 3100 (`reuseExistingServer:false`) — slow (~1–2 min build) but correct.
- Iterate per-spec: `pnpm test:e2e memory-cards.spec.ts` etc. Final gate: `pnpm test:e2e` (full).
- Also run `pnpm typecheck && pnpm lint && pnpm test` — they were green at handoff; keep them green.

## Caveats / shared-tree hazards

- **Parallel session active.** The branch was switched under this session at least once (a Stryker
  mutation-testing trial + a markdown/XSS-render change are in flight). Before committing, re-check
  `git branch --show-current` and stage **only** your own files by explicit path (never `git add -A`).
- At handoff, these working-tree files are **another session's**, not part of this work — leave them:
  `src/app/globals.css`, `src/components/markdown/*`, `src/components/markdown/markdown-plugins.ts`
  (untracked), plus `CLAUDE.md` / `AGENTS.md` / `TODO.md` / `.claude/*` churn.
- This is a plain change (no `change.md`); nothing to archive. Just commit each fix in its own logical
  batch with the repo's lowercase-imperative style.
