# User-editable, persisted AI system prompts — Plan Brief

> Full plan: `context/changes/editable-system-prompts/plan.md`
> Design spec: `context/changes/editable-system-prompts/design.md`

## What & Why

Let BYOK OpenRouter users tune the AI's behavior by editing the **System prompt** and having it persist.
Motivating pain: `CARDS_SYSTEM` hardcodes "3 to 7 cards", which is wrong for some material.

## Starting Point

The generate dialog already renders an editable System-prompt textarea + Reset button, but the edit is
ephemeral — `openConfig` wipes it on every open. Prompts are centralized in `prompts.ts`; a `previewPrompt`
keeps the shown prompt identical to the sent one.

## Desired End State

Edit the System prompt → **Save prompt** → it persists; reopening the dialog (anywhere that prompt key is
used) shows it and generation honors it. **Reset prompt** → AlertDialog confirm → deletes the override and
reverts to the built-in default.

## Key Decisions Made

| Decision        | Choice                                                                | Why                                                   | Source |
| --------------- | --------------------------------------------------------------------- | ----------------------------------------------------- | ------ |
| Editable scope  | All 3 system prompts (cards, notes_decompose, notes_topic)            | Full control, identical data model                    | Design |
| What persists   | System half only                                                      | Prompt half interpolates per-generation `${material}` | Design |
| Surface         | In the existing dialog, not a settings page                           | Edit where the prompt is already shown                | Design |
| Storage         | `user_prompts` table, row per (user, key)                             | Row absent = built-in; clean per-key reset            | Design |
| Reset semantics | DELETE the row                                                        | Re-attaches to future default improvements            | Design |
| Buttons         | Two: Save + Reset (Reset confirmed)                                   | User override of the 3-button recommendation          | Design |
| Default sync    | Generate action overlays resolved system                              | Preview (resolved) must equal sent, even unedited     | Plan   |
| Key plumbing    | Dialog derives key from `previewInput`; only `systemDefault` threaded | Minimal prop churn, single source                     | Plan   |

## Scope

**In:** `user_prompts` table + RLS (incl. DELETE); resolver with built-in fallback; Save/Reset actions;
generate-action resolver overlay; dialog seeding + two buttons + confirm; thread from 4 page boundaries;
neutralize the duplicate card-count `.describe()`.

**Out:** persisting the user-message half; settings page; output-schema count bounds; prompt-cache work.

## Architecture / Approach

`user_prompts(user_id, prompt_key, system)` PK `(user_id, prompt_key)`, RLS by `auth.uid()`.
`getResolvedSystemPrompts()` → `{ ...BUILTIN_SYSTEM, [key]: row.system }`. Resolved value is overlaid in
two places that read the same table (so they agree): the dialog seed (`systemDefault` prop, cosmetic) and
the generate action (`system = resolved[key]`, authoritative). Save = upsert, or delete when text equals
the built-in. Reset = delete + AlertDialog confirm.

## Phases at a Glance

| Phase                  | What it delivers                                             | Key risk                                          |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| 1. Data layer          | Migration + RLS, resolver, schema/helpers, describe fix      | Forgetting the DELETE policy (Reset needs it)     |
| 2. Actions + wiring    | Save/Reset actions; generate actions overlay resolved system | Unedited-save divergence if action skips resolver |
| 3. Dialog component    | `systemDefault` seed, Save + Reset(confirm), unit tests      | Save/Reset baseline state bookkeeping             |
| 4. Call-site threading | Resolve at 4 pages, thread `systemDefault`                   | Right key per site (notes/new has two)            |

**Prerequisites:** local Supabase stack up (`supabase start`); `pnpm db:types` after migration.
**Estimated effort:** ~1–2 sessions across 4 phases.

## Open Risks & Assumptions

- Assumes the `auto_bump_updated_at` trigger is generic enough to attach; else set `updated_at` in the upsert.
- `revalidatePath` for the dynamic `/notes/[id]` route uses the `'page'` form; client `savedSystem` state
  gives immediate feedback regardless.
- Browser flow verification deferred to `/10x-e2e` per the test plan.

## Success Criteria (Summary)

- Saved System prompt persists across dialog reopens and surfaces sharing the key; generation honors it.
- Reset asks for confirmation, then restores the built-in everywhere.
- Per-key independence; RLS isolates rows per user.
