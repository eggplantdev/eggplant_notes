---
change_id: ai-generation-robustness
title: Harden AI generation against silent failures before testing
status: implemented
created: 2026-06-08
updated: 2026-06-08
archived_at: null
---

> Review gate (2026-06-08): all automated legs green (typecheck/lint/unit 170/170); four-lens review
>
> - 4-agent /simplify found no high/medium issues. Manual dogfooding + Playwright E2E **deferred** to a
>   batched pass per user direction — the plans' Manual checkboxes remain unchecked by design.

## Notes

Pre-testing hardening of the single-shot AI generation workflow (`src/features/openrouter/`). The
system is a workflow, not an agent (one `generateObject` call per generation, human reviews before
save) — so agentic robustness (max-steps, tool-loop caps, multi-agent) is correctly absent and out
of scope. Observability (Langfuse-style tracing) is explicitly deferred.

Scope = the "genuinely missing, cheap, high-value" guards that turn silent failures loud:

1. **Empty-result guard for cards** — `generate-cards.ts` has no `length === 0` check; the notes
   action does (`generate-notes.ts:97`). A `{ cards: [] }` returns `success: true`, then
   `TopicGenerator`'s `data[0] && onResult(data[0])` silently no-ops on Apply. Mirror the notes guard.
2. **Schema hardening** (`ai-schemas.ts`) — bare `z.string()` accepts `""` (blank cards/notes save
   silently); add `.min(1)` to the string fields and `.describe()` to every field (S01E01: schema
   descriptions steer generation; currently the only steering is the system prompt).
3. **Typed errors** — both actions collapse every failure to `"AI generation failed. Try again."`
   Add a classifier mapping 401/403 (bad key → reconnect), 402 (credits), 429 (rate limit), 5xx/408
   (transient), `NoObjectGeneratedError` (bad shape), and timeout to actionable messages.
4. **Timeout / abort** — neither action bounds `generateObject`; a hung model spins "Generating…"
   forever. Add `abortSignal: AbortSignal.timeout(...)`, surfaced via the classifier.
5. **Outcome visibility (toasts)** — `GenerateDialog` sets `result`/`error` into dialog-local state
   only, and `apply()` fills the destination (candidate list / form fields / drafts preview) with no
   signal. On all four surfaces the result lands somewhere the user wasn't looking. Wire the existing
   `toastMessage` helper in: success + failure on generate, a caller-supplied hint on apply. The hint
   doubles as the teaching moment — generation fills a form/list; nothing saves until the explicit
   Save/Add/Create/Import step.

Not a code change: max-steps (no loops to cap), agentic feedback/self-correction (human-in-the-loop
review is the verification layer), app-level rate limiting (cost + connect gate are the brakes;
reconsider only if abuse shows up). Reference patterns: ai_devs S01E01 (structured output / schema
descriptions), S01E05 (limits, transient-error handling, status-code branching), S03E01
(observability — deferred).
