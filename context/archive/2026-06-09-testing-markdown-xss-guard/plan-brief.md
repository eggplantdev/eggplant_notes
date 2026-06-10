# Markdown Render XSS Guard (test-plan Phase 7) — Plan Brief

> Full plan: `context/changes/testing-markdown-xss-guard/plan.md`
> Research: `context/changes/testing-markdown-xss-guard/research.md`

## What & Why

Prove that untrusted markdown — from any source — renders **inert** through the project's single
`RenderMarkdown` pipeline: no script runs, no element/handler is injected, and `javascript:`/`data:text/html`
URLs are neutralized. The pipeline is safe by construction today (no `rehype-raw`, default `urlTransform`),
but that safety is **partially tested and undocumented**; this change adds the regression tripwire (R#7) that
turns red if a future edit re-enables execution.

## Starting Point

`e2e/notes.spec.ts:85-107` already proves raw-HTML inertness (`<script>`/`<img onerror>`) on the **user path
only** — it never tests dangerous URLs, and covers no other source. Meanwhile test-plan.md still calls the AI
note-body surface "unbuilt", though it shipped and archived 2026-06-07.

## Desired End State

A dedicated `e2e/markdown-xss.spec.ts` is green and asserts inert DOM + neutralized hrefs on **two** real
ingestion paths (user editor + `.md` import); the superseded user-path test is removed from `notes.spec.ts`;
and test-plan §2/§3 read truthfully (existing+new guard registered, four live sources named, both audit
backport rows accounted for).

## Key Decisions Made

| Decision          | Choice                                     | Why (1 sentence)                                                                                                                 | Source   |
| ----------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Source coverage   | Battery + convergence proof                | All 4 sources hit one renderer; test it hard once + prove convergence cheaply rather than 4 ingestion E2Es                       | Plan     |
| Test placement    | Dedicated `markdown-xss.spec.ts`           | Single-purpose intent, own seeded note, no contamination of the CRUD spec                                                        | Plan     |
| Doc scope         | Fix R#7 + §3, register D.1, log D.2        | Leave test-plan factually correct with both backports accounted for                                                              | Plan     |
| Card fields       | Covered-by-convergence (note only)         | Same `RenderMarkdown`; a redundant card assertion adds setup for ~zero signal                                                    | Plan     |
| URL oracle        | Assert empty/neutralized `href` in the DOM | `defaultUrlTransform` returns `''` for dangerous protocols (verified in react-markdown@10.1.0) — test our output, not "no alert" | Research |
| Convergence proof | `.md` import E2E (key-free)                | Import is deterministic and E2E-drivable; AI needs a live BYOK key so it's documented, not tested                                | Research |

## Scope

**In scope:** new XSS battery spec (user + import paths); removal of the superseded `notes.spec.ts` guard;
test-plan §2 R#7 + §3 Phase 7 corrections; D.1 framing; D.2 logged as a §2 row; §7 clarification.

**Out of scope:** any app-code/sanitization change; AI-UI and token-API ingestion E2Es (covered-by-convergence);
implementing D.2 ordering-integrity; a separate card-field test; Shiki fidelity/snapshot tests.

## Architecture / Approach

One spec, two tests, one shared four-vector payload (`<script>`, `<img onerror>`, `javascript:` link,
`data:text/html` link). Each test ingests via a different real path and asserts on the rendered `.prose`:
no live `script`/`img`, four `window.__xss*` flags stay falsy, raw markup survives as escaped text, and the
dangerous anchors carry an empty/neutralized `href`. AI + token-API convergence is documented via the shared
`import_notes`/`insertNoteWithChecks`→`RenderMarkdown` core.

## Phases at a Glance

| Phase                               | What it delivers                                              | Key risk                                                                   |
| ----------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1. XSS render-battery spec          | `e2e/markdown-xss.spec.ts` (user + import), old guard removed | Import-path payload colliding with the H1 split — keep payload in the body |
| 2. test-plan corrections + backport | Truthful §2 R#7 / §3 Phase 7; D.1 framed; D.2 logged          | Editing several §2/§3 cells without breaking table structure               |

**Prerequisites:** local Supabase stack up (`supabase start`); a clean working tree or worktree (the dirty
tree flagged at session start should be resolved before the E2E run).
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- **Single-pipeline assumption is load-bearing.** Battery+convergence only holds while every source renders
  through `RenderMarkdown`. The file-header comment + test-plan note record this so a future source that
  bypasses the renderer is recognized as needing its own test.
- Local GoTrue sign-up flake is covered by the existing `retries: 2` (lessons.md) — don't gate on it.
- The dirty working tree (probe-tmp.mjs + a migration SQL + ~12 modified files) wants resolving before
  `pnpm test:e2e` for a clean signal.

## Success Criteria (Summary)

- `pnpm test:e2e` green including `markdown-xss.spec.ts`; both tests demonstrably fail when `rehype-raw` or a
  permissive `urlTransform` is temporarily introduced.
- `e2e/notes.spec.ts` no longer carries the raw-HTML test.
- `test-plan.md` §2/§3 reflect reality; D.1 framed and D.2 logged.
