# Design — Per-generate model select + always-on prompt/token debug channel

**Status:** design approved (brainstorm), pending spec review → `/10x-plan`.
**Folds into:** S-19 `import-markdown-to-notes`, branch `feat/ai-assisted-authoring` (PR #1). Not a new change.
**Date:** 2026-06-07.

## Problem

Two gaps in the shipped S-19 AI half:

1. **No model choice at generation time, and the picker that was assumed in settings does not exist.** `ConnectCard` is connect/disconnect only. The `openrouter_credentials.model` column is never written, so `getOpenRouterModel` always falls through to `DEFAULT_OPENROUTER_MODEL` — every user is silently on `gpt-4o-mini`. It is not obvious what model is in use.
2. **No visibility into the prompt, the token cost, or a refinement trail.** Prompts are inline constants; there is no way to see the exact prompt sent, the tokens each task burns, or a stored history to compare prompt revisions.

## Decisions (locked in brainstorm)

- Model select is **permanent product**. Prompt view + token counts + logs are **always on, no `NODE_ENV`/`AI_DEBUG` gate**.
- Dialog model select is a **per-generate override**, pre-selected to the settings default; does **not** persist back.
- Settings gets a model picker that **does** persist (`credential.model`) — the default.
- Logs: local files (jsonl + md) **best-effort** (try/catch; no-ops on read-only prod FS) **plus** structured `console.log` (always, visible in `vercel logs`).
- File-log destination: repo path `context/changes/import-markdown-to-notes/ai-debug/` (gitignored). Not `/tmp`.

## Model resolution (coherent end-to-end)

```
per-generate override   >   settings default (credential.model)   >   DEFAULT_OPENROUTER_MODEL
      (GenerateDialog)              (ConnectCard — NEW write)                (fallback)
```

`getOpenRouterModel(overrideModelId?)`: `override ?? credential.model ?? DEFAULT`. Both `override` and the
settings write are validated against `OPENROUTER_MODELS` (reject off-list ids — cheap guard even under BYOK).

## Components

### 1. Single prompt source — `src/features/openrouter/prompts.ts` (new)

Pure builders, the one file edited during prompt refinement:

- `buildCardsPrompt(source) → { system, prompt }`
- `buildNotesPrompt(source) → { system, prompt }`

The inline `SYSTEM` / `SYSTEM_DECOMPOSE` / `SYSTEM_TOPIC` constants move here. Actions and the preview path
both consume these — no drift between what is previewed and what is sent.

### 2. Actions — thread model + return debug

- `generateCards` / `generateNotes` accept an optional `modelId` in their input, pass it to `getOpenRouterModel`.
- Capture `usage` off the `generateObject` result (exact AI SDK v6 field names verified in the plan).
- Return `GenerateResultT` extended with `debug: { system, prompt, usage }` — populated on **every** call.
- After generate (best-effort), call the logger.

### 3. Prompt preview action — `src/features/openrouter/actions/preview-prompt.ts` (new)

`previewPrompt(task, input, modelId) → { system, prompt }`. Runs the builder only — **no LLM call, zero cost**.
Feeds the dialog's live prompt view before the user commits to generating.

### 4. Settings model picker

- `src/features/openrouter/components/model-select.tsx` (new, client) — `<Select>` over `OPENROUTER_MODELS`.
  **Shared** by settings and the dialog (feature-internal, lives in `openrouter/components/`).
- `ConnectCard` (connected branch) gains the picker + new action `setOpenRouterModel(modelId)` →
  writes `credential.model` (allowlist-validated), revalidates.
- Surfaced explicitly: **"Default model: <label>"** + one line "used for all AI generation unless you
  override it per-generate."

### 5. Shared `GenerateDialog` — `src/features/openrouter/components/generate-dialog.tsx` (new)

Two-step: trigger click → dialog opens → confirm. Contents:

- model `<Select>` pre-selected to the settings default, default option tagged `(default)`.
- live prompt view (`previewPrompt`).
- **Generate** → `action(input, modelId)` → on success shows input/output/total **token counts**, then `onResult`.

Generic over the action: caller passes base input (noteId / topic / text) + `onResult`; the dialog injects `modelId`.

### 6. Logger — `src/lib/ai-debug/log-generation.ts` (new, server-only)

Per call: `console.log` (structured, always) + best-effort append to
`context/changes/import-markdown-to-notes/ai-debug/<date>.jsonl` and a readable `<date>.md`
(task, model, system, prompt, output, usage, latencyMs). File writes wrapped in try/catch — no-op on failure.
Add `context/changes/import-markdown-to-notes/ai-debug/` to `.gitignore`.

## Wiring — all four entry points route through GenerateDialog

- `TopicGenerator` (#2 topic→card, #5 topic→note) — wrap its button.
- import **decompose** button (#3 doc→notes) in `import-panel.tsx`.
- **generate-cards-button** (#1 note→cards) in memory-cards.

## Flow

```
[Generate] → GenerateDialog
  ├ model <Select>  (default = credential.model, tagged "(default)")
  ├ prompt preview  ← previewPrompt(task, input, modelId)   [no LLM cost]
  └ [Generate] → action(input, modelId)
        → buildXPrompt() → generateObject({ model, schema, system, prompt })   → { object, usage }
        → log-generation.ts  (console always; file best-effort)
        → result { data, debug: { system, prompt, usage } }
  → dialog shows token counts → onResult → preview/edit → save
```

## Out of scope (YAGNI)

- No Langfuse / Promptfoo / tracing infra.
- No model persistence from the dialog (settings is the only persist path).
- No `/tmp` prod logging, no logs viewer UI, no prod-vs-dev gating.

## Touched files

**Edit:** `server-client.ts`, `actions/generate-cards.ts`, `actions/generate-notes.ts`, `types.ts`,
`components/connect-card.tsx`, `components/topic-generator.tsx`, `features/import/components/import-panel.tsx`,
`features/memory-cards/components/generate-cards-button.tsx`, `.gitignore`.
**New:** `prompts.ts`, `actions/preview-prompt.ts`, `actions/set-model.ts`, `components/model-select.tsx`,
`components/generate-dialog.tsx`, `src/lib/ai-debug/log-generation.ts`.

## Risks / verify in plan

- AI SDK v6 `usage` field names (`generateObject` result shape) — confirm against the `ai` package before coding.
- `model-select.tsx` is shared by a server-component context (settings) and a client dialog — keep it a client
  component; settings passes the current default as a prop.
- `setOpenRouterModel` is a second writer of `credential.model` (none today) — single column, low risk, but
  revalidate the settings path so the displayed default stays truthful.
