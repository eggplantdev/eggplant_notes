# Handoff — test-plan rollout (post-refresh, 2026-06-10)

**Status of the thing I just finished:** `test-plan-refresh-2026-06-10` is **DONE + archived**.
The refresh re-grounded `context/foundation/test-plan.md` against the current suite. Nothing of
mine is uncommitted. Commits (on `feat/new-user-welcome-dialog`, **unpushed**):

- `785cee2` — refreshed `context/foundation/test-plan.md`
- `696a0cd` — change records (research/plan/impl-review)
- `d3db81c` — archive: `context/archive/2026-06-10-test-plan-refresh-2026-06-10/`

Read the archived `research.md` + `reviews/impl-review.md` there for full grounding — they hold
the file:line evidence behind everything below.

## What "continue" means

The refresh's purpose was to re-activate the test rollout. The orchestrator is **`/10x-test-plan`**
— it is stateful and re-derives state from disk, so just run it (or `/10x-test-plan --status`) and
it resumes at the first §3 phase that isn't `complete`. §3 Phases 1–5 are `not started` as
_dedicated_ rollout phases (no per-phase change folder exists); the refreshed §3 "Incidental-coverage
note" records what already exists per phase so you don't re-test it.

## The three actionable gaps the refresh surfaced (cheapest-first)

1. **API IDOR is not in the default gate.** `api-routes.integration.test.ts` + `api-tokens.integration.test.ts`
   are `RUN_INTEGRATION`-gated — `pnpm test` never runs them, only `pnpm test:integration`. Cheapest
   win: wire the integration leg into CI / the gate, or document it as a required manual step.
2. **R5 (credential lifecycle) — two missing assertions.** Nothing asserts the `openrouter_credentials`
   row is _gone_ after account delete (cascade exists in SQL but is untested at the behavior level), and
   there is **no error-body/client-bundle leak scan**. Both fit Phase 5.
3. **R4 (token spend) — over-limit refusal untested.** Per-request size caps exist
   (`generate-notes.ts`/`generate-cards.ts` Zod `.max()`), but no test drives them past the cap. **Low
   priority** (see decision 2). There is also no repeat/loop guard _in code_ — do NOT build one without
   operator sign-off.

## Two operator-approved decisions — do not relitigate

1. Token `/api/*` surface = **R1 by convergence**, NOT a 9th risk row. (Same IDOR scenario, different
   entry door.)
2. R4 spend-loop = **documented known gap**, BYOK-mitigated (a loop burns the _user's own_ OpenRouter
   credits, which OpenRouter caps). **No product code, no Linear issue, no rate-limiter** unless the
   operator explicitly asks.

## Shared-working-tree hazards (critical)

- One `HEAD`, multiple parallel agents. A perf-audit session is committing to the SAME branch
  (`feat/new-user-welcome-dialog`) — HEAD has already moved past my commits. **Re-check
  `git branch --show-current` before every commit**, and **stage by explicit path** (never `git add -A`).
- Do not touch these (other sessions' in-flight work): `tsconfig.json`, `probe-tmp.mjs`, `.next-perf/`,
  `context/changes/perf-audit-2026-06-10/`.
- lint-staged runs prettier on commit — expect `.md`/`.json` reformatting in your staged diff; it's benign.
- Nothing is pushed. Pushing this branch = a prod deploy of everything on it (not just the test-plan
  docs). That's the operator's call.

## Delete this file once consumed

This is a transient handoff, not a foundation doc.
