---
change_id: model-picker-sort-favorites
title: Model picker — sort by input/output cost or name + per-user favorites
status: archived
created: 2026-06-08
updated: 2026-06-08
archived_at: 2026-06-08T10:56:55Z
---

## Notes

Make the shared OpenRouter `ModelSelect` more robust: (1) a sort control over the catalog — Name A→Z (default), Input $ low→high, Output $ low→high; (2) a per-user favorites set — star models from the catalog, surfaced as a "Favorites" group above "Recommended". Both ship in the shared `ModelSelect`, so the settings default picker and the per-generate dialog inherit them with zero consumer changes. Sort is local per-open UI state (pure `sortModels` helper in `models.ts`). Favorites is global per-user state, self-loaded by `ModelSelect` (alongside the catalog it already lazy-loads) via new `listFavoriteModels` / `toggleFavoriteModel` server actions, persisted in a new `favorite_models text[]` column on `openrouter_credentials`. Design spec: `docs/superpowers/specs/2026-06-08-model-picker-sort-favorites-design.md`.
