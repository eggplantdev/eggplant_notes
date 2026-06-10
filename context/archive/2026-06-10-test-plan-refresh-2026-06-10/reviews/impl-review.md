# Impl review — test-plan-refresh-2026-06-10

Doc-only change, so the review is a **doc-accuracy + consistency audit** (the code-quality
fan-out — tailwind/cohesion/scatter/impl-review-of-code — is N/A: no source in the diff).
Full gate record was a throwaway in `/tmp` per the slice-review-gate convention; this file is
the durable summary.

## Verdict: PASS — accurate + internally consistent

Independent read-only audit cross-checked every refreshed claim against the repo:

- **CONFIRMED:** spec counts (39 unit / 22 e2e exact); R4 size-caps exist
  (`generate-notes.ts:29,44`, `generate-cards.ts:43`, `prompt-schemas.ts:11`) AND no
  call-count/repeat guard anywhere (grep-confirmed); hardening fixes (3)(4)(5) have regression
  tests, (1)(2) do not; both `*.integration.test.ts` are `RUN_INTEGRATION`-gated (not in the
  default `pnpm test` gate); tool versions match `package.json`; §3 `not started` literals
  reconcile with the incidental-coverage note (parser-literal kept by design); §2 R1
  convergence note agrees with the §8 ledger; markdown tables intact.
- **WRONG (fixed):** three hot-spot churn figures off by 1–2 (rolling-window drift) — subjects
  110→108, auth 40→42, openrouter 157→156. Corrected directly before commit.
- **INCONSISTENT / NIT:** none.

## Decisions (operator-approved 2026-06-10, "okay with both")

1. Token `/api/*` surface → **R1 by convergence** (same IDOR scenario, different entry door),
   not a 9th risk row. Actionable note added: its IDOR specs are default-skipped.
2. R4 spend-loop gap → **documented as a known gap** (size cap exists, no loop guard;
   BYOK-mitigated — a loop burns the user's own OpenRouter credits, which OpenRouter caps).
   No product code, no Linear issue.

## Suite

Not run — change touches zero code files; the doc is not in the build/lint/type/test graph.
Recorded as skipped-with-reason, not deferred.
