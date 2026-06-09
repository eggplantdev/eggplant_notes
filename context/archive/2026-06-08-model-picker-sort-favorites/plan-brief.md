# Model picker — sort + favorites — Plan Brief

> Full plan: `context/changes/model-picker-sort-favorites/plan.md`
> Design spec: `docs/superpowers/specs/2026-06-08-model-picker-sort-favorites-design.md`

## What & Why

The OpenRouter model picker works but is thin: the 300+ catalog can only be text-searched, and there's a single hardcoded "Recommended" set. Add (1) sorting by **input cost / output cost / name**, and (2) a per-user **favorites** set. Both ship in the shared `ModelSelect`, so the settings default picker and the per-generate dialog get them at once.

## Starting Point

`ModelSelect` (`src/features/openrouter/components/model-select.tsx`) is a cmdk combobox that lazy-loads the catalog on popover-open and groups it into Recommended + All models, showing per-row prices. `OpenRouterModelT` already carries `inputPrice`/`outputPrice`. One default model persists on `openrouter_credentials.model`.

## Desired End State

In any model picker the user can switch sort mode (cheapest-first on price sorts) and star/unstar models. Starred models form a "Favorites" group at the top, persist across sessions, and appear on every model-select surface.

## Key Decisions Made

| Decision                 | Choice                                               | Why                                                              | Source     |
| ------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------- | ---------- |
| Cost filter UX           | Sort toggle (Name / Input ↑ / Output ↑)              | Cheapest-first is the real need; fits the popover                | Brainstorm |
| "Default models" meaning | Curated favorites set                                | User curates go-to models; one default still applies             | Brainstorm |
| Sort mode count          | 3 (no ↓ variants)                                    | Keep the popover tight                                           | Brainstorm |
| Sort scope               | Uniform comparator across all groups                 | Predictable ordering                                             | Brainstorm |
| Favorites wiring         | Self-load in `ModelSelect`                           | Global per-user state; avoids threading props through 7 files    | Plan       |
| Persistence              | `favorite_models text[]` on `openrouter_credentials` | Shares the credential's RLS + cascade; no new table              | Spec       |
| Toggle return            | Plain `ActionResultT`                                | Shared type is payload-less; component reconciles optimistically | Plan       |

## Scope

**In scope:** sort control; favorites column + read/write actions; Favorites group + per-row star; `sortModels` pure helper + unit tests.

**Out of scope:** descending sorts; price threshold / tier chips; a file/vision default; per-feature defaults; favorites cap; any consumer/page changes.

## Architecture / Approach

Confined to `src/features/openrouter/`. Pure `sortModels` in `models.ts` (unit-tested). `listFavoriteModels` (read) + `toggleFavoriteModel` (write) actions mirror the existing `list-models.ts` / `set-model.ts`. `ModelSelect` self-loads favorites alongside the catalog it already loads, renders a Favorites group + star toggle, and applies `sortModels` to every group. No props change; no consumer changes.

## Phases at a Glance

| Phase         | What it delivers                                         | Key risk                                             |
| ------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| 1. Schema     | `favorite_models` column + migration                     | Forgetting `db reset` to apply locally               |
| 2. Sort logic | `ModelSortT` + `sortModels` + tests                      | Tie-break correctness                                |
| 3. Actions    | `listFavoriteModels` + `toggleFavoriteModel` + read-path | Allowlist/auth parity with `set-model.ts`            |
| 4. Picker UI  | Sort control, Favorites group, star toggle, self-load    | Star tap must not select the model (cmdk `onSelect`) |

**Prerequisites:** local Supabase stack up (`supabase start`); connected OpenRouter credential for manual checks.
**Estimated effort:** ~1 session across 4 phases.

## Open Risks & Assumptions

- Star button inside a cmdk `CommandItem` needs `stopPropagation` or it triggers model selection — called out in Phase 4.
- A second server read on first popover-open (favorites) — parallelized with the catalog fetch, so no added latency.

## Success Criteria (Summary)

- Sort reorders the catalog (cheapest-first on price sorts) in every picker.
- Starring persists across reload and appears on settings + generate + import surfaces.
- No regression to model selection or the per-run override.
