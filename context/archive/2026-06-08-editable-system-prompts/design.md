# Design — User-editable, persisted AI system prompts

**Change:** `editable-system-prompts` · 2026-06-08

## Problem

BYOK OpenRouter users need to tune the AI's behavior. The motivating case: `CARDS_SYSTEM` hardcodes
"3 to 7 cards" (`src/features/openrouter/prompts.ts:39`), which makes no sense for some material.

The generate dialog already exposes an editable System-prompt textarea and a Reset button
(`generate-dialog.tsx:205`, `:193`), but the edit dies with the dialog — `openConfig` resets the
override to `undefined` on every open (`generate-dialog.tsx:110`). The work is to make that edit
**persist per user**.

## Scope

- **In:** persist the **System prompt** for three keys — `cards`, `notes_decompose` (text + PDF
  decompose share `NOTES_DECOMPOSE_SYSTEM`), `notes_topic`.
- **Out:** the **Prompt** (user-message) half — it interpolates per-generation material (`${material}`)
  and stays an ephemeral one-shot override, exactly as today. No template tokens. No settings page (the
  edit lives in the dialog where the prompt is already rendered). Prompt-cache fragmentation is a
  non-issue (BYOK).

## Architecture

### 1. Data + resolver

New table `user_prompts` (migration under `supabase/migrations/`):

| column       | type        | notes                                                           |
| ------------ | ----------- | --------------------------------------------------------------- |
| `user_id`    | uuid        | FK → auth.users; part of PK                                     |
| `prompt_key` | text        | `'cards'` \| `'notes_decompose'` \| `'notes_topic'`; part of PK |
| `system`     | text        | the override                                                    |
| `updated_at` | timestamptz | default now()                                                   |

PK `(user_id, prompt_key)`. RLS: all ops gated `using/with check (user_id = auth.uid())`, mirroring
existing tables. **Row absent = using the built-in default.** No separate "is default" flag.

New server-only resolver in the openrouter feature:

```
getResolvedSystemPrompts(client?) → Record<PromptKey, string>
// returns { cards: row?.system ?? CARDS_SYSTEM, notes_decompose: … ?? NOTES_DECOMPOSE_SYSTEM, … }
```

The constants in `prompts.ts` remain the fallback. The prompt builders change from hardcoding the
constant to accepting the resolved system string; the user-message half is unchanged.

### 2. Schema `.describe()` neutralization

`ai-schemas.ts:25` — the cards array `.describe('3 to 7 recall cards covering the key ideas.')` is sent
to the model as steering (per the file's own header comment), so it's a SECOND, hidden voice on card
count. With the system prompt now user-owned, neutralize it to a count-agnostic
`'Recall cards covering the key ideas.'` so the system prompt is the single lever. No length bounds
exist or are added (the schema deliberately has none — see `ai-schemas.ts:9-12`).

### 3. Dialog persistence (`generate-dialog.tsx`)

- **Seeding:** new optional prop `systemDefault?: string` (the resolved saved override), threaded from
  the server component that already fetches `connected`/`defaultModel`. Then
  `defaults = { ...previewPrompt(previewInput), system: systemDefault ?? <constant> }`. Reopening the
  dialog shows the saved prompt — persistence is visible. **Preserves the preview-can't-drift
  invariant** (`prompts.ts:5-8`): the same resolved system feeds the action, which re-resolves
  server-side under RLS.
- **Two buttons** by the System-prompt label (replacing the current in-memory `Reset to default`):
  - **Save prompt** — enabled when the System text ≠ the saved effective value. Calls
    `saveUserPrompt(key, system)`: validates, then **upserts**; if the text equals the built-in
    constant it **deletes** the row instead (no silent fork onto a frozen copy of the default).
  - **Reset prompt** — destructive. Opens an `AlertDialog` (reusing `components/ui/alert-dialog.tsx`,
    modeled on `account/components/delete-account-dialog.tsx`): title "Reset to built-in prompt?", body
    "Your customized prompt will be permanently deleted and AI generation will use the built-in default
    again. This can't be undone." → Cancel / Reset. On confirm: `resetUserPrompt(key)` deletes the row;
    the textarea reverts to the constant. Unsaved typing is discarded by the same action.
- The **Prompt** textarea (user-message half) is untouched — per-generation ephemeral override as today.
- "Save"/"Reset" mutate the **persisted** default; `Generate` with an edited Prompt still sends a
  one-shot override — two orthogonal mechanisms.

### 4. Actions + validation

Server actions in the openrouter feature:

- `saveUserPrompt(key, system)` — Zod-validated, upsert/delete-if-default, `revalidatePath` the
  surfaces that render the dialog.
- `resetUserPrompt(key)` — `DELETE` the row, `revalidatePath`.

New `userPromptSchema`: `system` `.trim().min(1).max(MAX_PROMPT_CHARS)`, reusing the existing
`MAX_PROMPT_CHARS = 100_000` (`prompts.ts:15`). Validation runs server-side; failures surface via the
existing `toastMessage` error pattern. `prompt_key` validated against the three-value union. RLS scopes
every op to the owner — no `user_id` crosses the client boundary.

## Error handling

- Empty / oversized system text → Zod error → friendly error toast; no row written.
- Save when text equals built-in → row deleted (idempotent re-attach to default).
- Reset when no row exists → no-op delete; textarea already shows the constant.

## Testing

- **Unit (Vitest, fits the `stryker` `mutate` glob):** the resolver fallback (`row ?? constant`) and
  the save action's delete-if-equals-built-in branch — pure logic.
- **Browser flow (save → reopen shows saved → reset → confirm → back to built-in):** defer to
  `/10x-e2e` per the project test plan; not invented here.

## Files touched (anticipated)

- `supabase/migrations/<new>.sql` — `user_prompts` table + RLS.
- `src/features/openrouter/prompts.ts` — builders accept resolved system; export `userPromptSchema`,
  `PromptKey` type.
- `src/features/openrouter/ai-schemas.ts` — neutralize the cards `.describe()` count.
- `src/features/openrouter/queries.ts` (or new file) — `getResolvedSystemPrompts`.
- `src/features/openrouter/actions/` — `save-user-prompt.ts`, `reset-user-prompt.ts`.
- `src/features/openrouter/components/generate-dialog.tsx` — `systemDefault` prop, two buttons, confirm.
- Dialog call sites (server components) — resolve + thread `systemDefault` for their key.
- `src/lib/supabase/types.ts` — regenerated DB types.
