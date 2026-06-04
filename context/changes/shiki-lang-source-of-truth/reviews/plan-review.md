<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Shiki Language Source of Truth

- **Plan**: `context/changes/shiki-lang-source-of-truth/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-04
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | PASS    |
| Plan Completeness     | WARNING |

## Grounding

4/4 paths ✓ (`code-languages.ts`, `render-markdown.tsx`, `e2e/notes.spec.ts`, `e2e/helpers.ts`), `CODE_LANGUAGES` (20 entries incl. `text`) ✓, brief↔plan ✓.

Verified against the actual installed `@shikijs/rehype@4.1.0` source:

- `langs = options.langs || Object.keys(bundledLanguages)` — `dist/index.mjs:6` (the unconstrained default is real).
- `lazy` + `fallbackLanguage` exist and behave as described — `dist/core-BUhjvszS.mjs:33,78-100`: under `lazy`, an unknown fence tries `loadLanguage(lang)` and on `.catch` renders `fallbackLanguage`. The plan's insight that the fallback only fires for a genuinely unresolvable token (a real off-list language lazy-loads instead) is correct.
- `'text'` (fallback target) is in `CODE_LANGUAGES`, so it's preloaded and the fallback can't itself fail.

## Findings

### F1 — New E2E assertion doesn't say how to isolate the bogus block

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, change #3 (`e2e/notes.spec.ts`)
- **Detail**: A fallback-to-`text` block still renders as `<pre class="shiki">`, just with no `--shiki` token spans. The existing global selector `pre.shiki span[style*="--shiki"]` therefore also matches the on-list (python) block's tokens. If the bogus and python fences share a note (or any note on the page has a highlighted block), a naive `toHaveCount(0)` either fails or passes for the wrong reason without proving the fallback. The plan's contract said "that block carries no --shiki tokens" but never specified scoping the locator to that `<pre>`.
- **Fix**: Put the bogus ` ```xyzzy ` fence in its OWN separate note; on its detail view assert `pre.shiki` visible (no throw) AND `pre.shiki span[style*="--shiki"]` count === 0. Keep the on-list highlight assertion on its own python note. Two notes, two independent assertions.
- **Decision**: FIXED (applied to plan.md, Phase 1 change #3 Contract)

### F2 — Lazy-load accumulation erodes the memory win over process life

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — awareness only, no action required
- **Dimension**: Blind Spots
- **Location**: Phase 1 (`lazy: true` on the process-global singleton)
- **Detail**: `loadLanguage` permanently mutates the shared singleton. A long-running server that encounters many distinct off-list (but valid) languages accumulates grammars back toward the full set, so ~37MB is a floor not a ceiling. The boot win (~3.3s→0.14s) is permanent regardless; benchmark showed 0 fallbacks on real content, so realistic drift is negligible. No change needed — just don't cite 37MB as a steady-state cap.
- **Decision**: ACCEPTED (awareness only)
