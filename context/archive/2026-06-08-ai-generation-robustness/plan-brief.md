# Plan brief — ai-generation-robustness

**Goal:** turn the AI generation workflow's silent failures and silent successes loud, before testing.

**Why now:** every outcome is currently invisible or misleading — empty results no-op on Apply, blank fields save silently, every error collapses to one generic string, a hung model spins forever, and nothing toasts so the user "doesn't know what happened."

## Three phases (each independently testable)

| Phase                      | Makes the…         | Key changes                                                                                                                                           | New files                                            |
| -------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **1 — Output integrity**   | output trustworthy | `.describe()` on schema fields; drop incomplete items; cards gets the empty-guard notes already has (≥1 enforced at **runtime**, not `z.array().min`) | `utils/sanitize-generated.ts`                        |
| **2 — Failure surfacing**  | failures legible   | typed error classifier (401/403→reconnect, 402→credits, 429→wait, 5xx/408→transient, bad-shape, timeout); 60s `AbortSignal.timeout`                   | `constants.ts`, `utils/describe-generation-error.ts` |
| **3 — Outcome visibility** | outcome visible    | wire `toastMessage` into `GenerateDialog`: success/failure on generate, caller-supplied hint on apply; thread noun + hint through all 4 callers       | —                                                    |

## Locked decisions

- ≥1-item invariant is **runtime**, never `z.array().min(1)` — a schema min throws a generic `NoObjectGeneratedError` and kills the friendly message.
- Drop-incomplete-keep-rest (not hard-fail-batch); dropped count logged so the drop isn't invisible.
- Apply-hint toasts double as the teaching moment: generation fills a form/list; **nothing saves until the explicit Save/Add/Create/Import step.**

## Out of scope (correctly absent)

Observability/tracing · max-steps / agentic loops (no loops exist) · automated self-correction (human review is the verification layer) · app-level rate limiting · schema count/length bounds · retry-on-transient (SDK `maxRetries: 2` covers it).

## Verify

`pnpm typecheck && pnpm lint && pnpm test` per phase + manual dialog runs (right message per failure class; success/failure/apply toasts on every surface).
