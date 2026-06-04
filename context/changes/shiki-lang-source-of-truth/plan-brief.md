# Shiki Language Source of Truth — Plan Brief

> Full plan: `context/changes/shiki-lang-source-of-truth/plan.md`

## What & Why

Markdown code highlighting loads **all ~200 Shiki grammars** into the shared, process-global highlighter because `RenderMarkdown` passes no `langs`. That costs a measured **~3.3s boot + ~129MB** on the first markdown render of every server process. Constrain it to the ~20 languages we actually offer, derived from one source of truth, and lazy-load the rest.

## Starting Point

`src/components/markdown/render-markdown.tsx` is the only Shiki construction site; it passes only `themes`. `code-languages.ts` already exports `CODE_LANGUAGES` (20 entries) for the code-block picker. `e2e/notes.spec.ts` already asserts on-list highlighting.

## Desired End State

`RenderMarkdown` preloads the curated 20, lazy-loads anything off-list on demand, and renders an unknown fence as plain text without throwing. The picker and the highlighter share `CODE_LANGUAGES`, so they cannot drift. Highlighting looks identical for the languages we use; cold-start is ~23× faster.

## Key Decisions Made

| Decision              | Choice                                                         | Why                                                                                  | Source    |
| --------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------- |
| Language set          | Curated 20 via `SHIKI_LANGS = CODE_LANGUAGES.map(l ⇒ l.value)` | One source of truth — picker + highlighter can't drift                               | change.md |
| Loading               | `lazy: true` (preload 20, load off-list on demand)             | Common case fast; rare langs still highlight without bloating boot                   | change.md |
| Unknown fence         | `fallbackLanguage: 'text'` → plain text                        | Degrade gracefully, never throw on a render path                                     | change.md |
| Per-user lang setting | Rejected                                                       | Fights the process-global singleton; future user-settings concern                    | change.md |
| Testing               | Extend `e2e/notes.spec.ts` (bogus-fence → plain assertion)     | Reuses the render-test path; unit-testing an async Shiki server component is awkward | Plan      |

## Scope

**In scope:** `code-languages.ts` (new `SHIKI_LANGS` export), `render-markdown.tsx` (config), `e2e/notes.spec.ts` (one assertion).

**Out of scope:** per-user/dynamic language selection; the client live preview (no Shiki); adding new languages to `CODE_LANGUAGES`; the four consumer pages (benefit automatically).

## Architecture / Approach

`CODE_LANGUAGES` → `SHIKI_LANGS` (ids only) → passed as `langs` to `@shikijs/rehype` alongside `lazy: true` + `fallbackLanguage: 'text'`. One component fix covers all four `RenderMarkdown` consumers (notes detail, subject view, `/review`, topic-checks).

## Phases at a Glance

| Phase                             | What it delivers                   | Key risk                                                                                                              |
| --------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1. Constrain Shiki to curated set | `SHIKI_LANGS` + config + E2E guard | A language used in real notes isn't in the 20 → it lazy-loads (fine) or, if invalid, falls back to plain (acceptable) |

**Prerequisites:** S-01 (`RenderMarkdown`) and S-06 (subject view) already shipped; local Supabase stack for E2E.
**Estimated effort:** ~1 short session, single phase.

## Open Risks & Assumptions

- Assumes the curated 20 cover the languages in real/seeded notes (Python seed uses `py`/`python`/`css`/`js` — all covered or alias-resolved; benchmark showed 0 fallbacks).
- `lazy: true` makes the curated list a preload hint, not a hard cap — off-list fences _will_ highlight if Shiki has the grammar. Accepted (matches "load what content uses").

## Success Criteria (Summary)

- On-list fences still render highlighted (existing E2E green).
- Bogus/unknown fence language renders as plain text, no error (new E2E assertion). (A valid off-list language lazy-loads and highlights — intended under `lazy`.)
- `pnpm typecheck`/`lint`/`build`/`test:e2e` green.
