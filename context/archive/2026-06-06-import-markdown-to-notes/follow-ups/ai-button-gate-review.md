# Slice review — AI button variant + always-render connect gate (2026-06-07)

Findings from the per-slice review gate (4-check parallel fan-out: `/10x-impl-review`,
`/tailwind-v4-audit`, `feature-first-structure`, `/module-cohesion-audit`), scoped to the
**AI-button/gate stream only**. IDs are `AG-*` to avoid colliding with the pre-existing `F3/F5`
in `review-fixes.md` (those are unrelated: OAuth state, note ownership).

## What this stream added

- `ai` Button variant (`src/components/ui/button.tsx`): `gradient-border neon-glow-fuchsia
hover:neon-glow-fuchsia-hit text-white transition-shadow disabled:opacity-100`. Reuses existing
  `@utility`s; `disabled:opacity-100` makes a disabled AI button look identical to enabled (stays
  inert via base `disabled:pointer-events-none`).
- `useAiGate(connected)` hook + `ConnectGateDialog`: every AI feature button is **always rendered**
  (previously hidden when OpenRouter disconnected); a disconnected click opens a "bring your own API
  key → Connect OpenRouter / Cancel" dialog instead of running.
- `NavConnectButton`: shown in the nav (AppNav desktop + MobileNav) only when disconnected; AppNav
  became an async Server Component calling `isOpenRouterConnected()`.
- Import panel explanatory copy (split-level help + split-vs-AI); flow description back in the page
  subtitle.

## ⚠️ Process context for whoever runs /simplify

- The parallel **model-select / prompt-debug** stream merged into these files during the review and
  refactored the per-button wiring into a shared `GenerateDialog`, which now **consumes**
  `useAiGate` + `variant="ai"` (`generate-dialog.tsx:52`). The gate foundation is intact and adopted,
  not orphaned. Do **not** delete `useAiGate` / `ConnectGateDialog` / the `ai` variant as "unused".
- **`pnpm typecheck` is currently RED (4 errors)** and they all trace to the parallel stream's
  unfinished wiring (`PreviewInputT` only admits `task:'notes'`; unfinished `defaultModel` prop
  threading in `card-form`/`note-form`/page files). **None originate in the gate code.** Don't fix
  those from this stream; re-run `next typegen && pnpm typecheck` once the parallel stream lands.
- Files interleaved between the two streams (edit with care): `import-panel.tsx`, `topic-generator.tsx`,
  `generate-cards-button.tsx`, `card-form.tsx`, `note-form.tsx`.

## Actionable by /simplify (reuse / cleanup — do these)

### AG-1 [reuse] — Consolidate the duplicated "Connect OpenRouter" CTA

The same `<form action={connectOpenRouter}>` + `<Button variant="ai"><Sparkles/>Connect OpenRouter</Button>`
is hand-written in **three** places:

- `src/features/openrouter/components/connect-card.tsx` (not-connected branch, ~L34–42)
- `src/features/openrouter/components/connect-gate-dialog.tsx` (footer, ~L42–47)
- `src/features/openrouter/components/nav-connect-button.tsx` (whole file)

The label + Sparkles + `variant="ai"` + connect form are identical. **Extract one
`ConnectOpenRouterButton`** (label + icon + form, accepts `className`) in
`src/features/openrouter/components/` and have all three render it. Past the 2nd-consumer promotion
bar. Note `NavConnectButton` passes `className="mt-2 w-full justify-start"` (mobile) — keep that
pass-through.

### AG-2 [placement] — Move `useAiGate` out of `components/`

`src/features/openrouter/components/use-ai-gate.tsx` is a **hook**, not a component. AGENTS.md binds
`components/` to `.tsx` components; feature-scoped hooks live at the feature root (or a `hooks/` dir),
e.g. `features/auth/use-session.ts`. Move to `src/features/openrouter/use-ai-gate.tsx` (keep `.tsx`
for the returned JSX) and update importers: `generate-dialog.tsx` (parallel-stream file — coordinate),
and any other live importer. **Touches a parallel-stream file; do only if the streams are settled.**

### AG-3 [robustness] — Guard `ConnectGateDialog` against nested-form misuse

`connect-gate-dialog.tsx` renders a `<form action={connectOpenRouter}>` in the dialog footer. Current
mounts are non-nested and fine, but it's one refactor from being placed inside another `<form>`
(invalid HTML, unpredictable submit). Add a one-line comment at the form: _"Must never be rendered
inside another `<form>` — nested forms are invalid HTML."_ Zero behavior change.

## Defer (NOT for /simplify)

### AG-4 [plan drift / spec] — Always-render + gate inverts the written plan

`plan.md` repeatedly specifies AI controls are **hidden when not connected** (Phase 3 #2, Phase 4 #2,
success criteria 3.7 / 4.7 / 5.8). This stream deliberately reverses that to always-render + gate-on-click.
Sound discoverability call, but it's drift: those success criteria and any E2E asserting "AI button
absent when disconnected" must be rewritten to assert "the connect **dialog** opens instead." Record a
plan addendum so the next review doesn't re-flag it as a regression. (Spec/doc work — and no E2E this
round.)

### AG-5 [perf, S-11] — AppNav async = per-nav DB query, fetched 2×/page

`src/components/app-nav/app-nav.tsx:10-11` awaits `isOpenRouterConnected()` on every protected page
render (it wraps all of them); each page ALSO fetches the same boolean to pass `aiEnabled` down — so
2 queries/page. Negligible for a solo MVP. If nav latency ever shows, dedupe via React `cache()` around
`isOpenRouterConnected` (one query/request, shared by nav + page). Plan defers caching to S-11.

### AG-6 [not ours] — typecheck red

4 errors, all from the parallel stream (see Process context). Re-verify after that stream lands. Do
not patch from here.

## Keep / dismissed (no action)

- **AG-7 `disabled:opacity-100`** — intentional (owner wanted disabled AI buttons to look identical to
  enabled). UX note only: a glowing button that ignores clicks has no cursor cue; current in-context
  labels ("Decomposing…", empty-text helper copy) are deemed sufficient. **Keep.**
- **Cohesion** — `useAiGate` returning `{ guard, gateDialog }` is one concern (open/close state binds
  them); `import-panel.tsx` is large but single-concern (everything converges on `drafts`); `button.tsx`
  exporting `buttonVariants` is the canonical shadcn pattern. No splits required. (Optional cosmetic:
  extract the import help `<p>` copy into an `ImportHelpText` component — low priority.)
- **Tailwind v4** — zero violations introduced by this stream. (`button.tsx:16`'s
  `hover:bg-[color-mix(...var(--secondary)...)]` is pre-existing radix-nova on the `secondary` variant,
  out of scope.)
