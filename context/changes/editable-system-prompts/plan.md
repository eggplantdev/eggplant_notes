# User-editable, persisted AI system prompts — Implementation Plan

## Overview

Make the generate dialog's **System prompt** edit persist per user. Today the dialog already exposes an
editable System-prompt textarea and a Reset button, but the edit dies with the dialog (`openConfig`
clears the override on every open). This adds a `user_prompts` table, a server-side resolver that falls
back to the built-in constant, two server actions (Save / Reset), and two dialog buttons — so a BYOK
user can tune the AI's behavior (e.g. drop the hardcoded "3 to 7 cards" rule) and have it stick.

## Current State Analysis

- **Prompts are centralized** in `src/features/openrouter/prompts.ts`: three system constants
  (`CARDS_SYSTEM:35`, `NOTES_DECOMPOSE_SYSTEM:50`, `NOTES_TOPIC_SYSTEM:57`) and pure builders.
  `previewPrompt` (`:91`) builds the exact prompt the dialog shows, from the same builders the actions
  use — the "preview can't drift from sent" invariant (`prompts.ts:5-8`).
- **The dialog already edits both halves** (`generate-dialog.tsx`): System textarea `:205`, Prompt
  textarea `:216`, in-memory `Reset to default` `:193`. The edit is an `override` sent verbatim to the
  action; `undefined` means "action builds it server-side". `openConfig:110` resets `override` to
  `undefined` on every open — hence no persistence.
- **A second, hidden card-count voice:** `ai-schemas.ts:25` `.describe('3 to 7 recall cards …')` is sent
  to the model as steering (per `ai-schemas.ts:6-8`). Neither place enforces count (no length bounds —
  `ai-schemas.ts:9-12`); both merely steer.
- **Persistence precedent:** `user_settings` table + RLS (`supabase/migrations/20260604122940_add_user_settings.sql`),
  read via `getDailyGoal` (`settings/queries.ts`). Action precedent: `update-daily-goal.ts`
  (`runTableAction` + `revalidatePath`). Destructive-confirm precedent: `delete-account-dialog` →
  `DeleteButton` → `ConfirmDeleteDialog` over `components/ui/alert-dialog.tsx`.
- **4 dialog call sites**, all client components, each fed by a page-level server boundary that already
  calls `getOpenRouterStatus()`:
  | Call site | Server boundary (page) | task → prompt_key |
  | --- | --- | --- |
  | `memory-cards/components/generate-cards-button.tsx` | `notes/[id]/page.tsx` | cards |
  | `notes/components/memory-cards-field.tsx` (create) | `notes/new/page.tsx` | cards |
  | `openrouter/components/topic-generator.tsx` (in `card-form`) | `memory-cards/new/page.tsx` | cards |
  | `openrouter/components/topic-generator.tsx` (in `note-form`) | `notes/new/page.tsx` | notes_topic |
  | `import/components/import-panel.tsx` | `import/page.tsx` | notes_decompose (text + PDF) |

## Desired End State

A user edits the System prompt in the generate dialog and clicks **Save prompt**; it persists. Reopening
the dialog (anywhere that key is used) shows the saved prompt, and generation uses it. **Reset prompt**
shows an AlertDialog confirm, then deletes the saved prompt and reverts to the built-in default.
Verify: edit + save cards prompt → reopen on another note → saved text shows → generate honors it →
reset → confirm → built-in text returns.

### Key Discoveries

- Dialog can derive `promptKey` from `previewInput` — no key prop needed (`prompts.ts:85-95` already maps
  task → builder). Add a `promptKeyFromPreviewInput` helper.
- `systemDefault` rides the same prop path as `defaultModel` from each page's `getOpenRouterStatus()`.
- `user_settings` migration has **no DELETE policy**; `user_prompts` needs one (Reset deletes rows).
- Generate actions must overlay the resolved `system` in their non-override branch, else preview
  (resolved) and sent (constant) diverge for a user who saved but didn't edit in-dialog.

## What We're NOT Doing

- Not persisting the **Prompt** (user-message) half — it interpolates per-generation `${material}`;
  stays an ephemeral one-shot override exactly as today. No template tokens.
- No settings-page surface — editing lives in the dialog where the prompt is already rendered.
- No length/count bounds added to the AI output schema (it deliberately has none).
- No prompt-cache accommodation (BYOK — irrelevant).

## Implementation Approach

Bottom-up: data + resolver first, then actions, then the generic dialog (with `systemDefault` optional
so the app keeps working), then thread the resolved value from the 4 server boundaries. Each phase is
independently verifiable. Builders stay pure and unchanged in signature; the resolved system is overlaid
at two points — the dialog (cosmetic preview seed, via prop) and the action (authoritative, via
resolver). Both read the same table, so they agree.

## Critical Implementation Details

- **Resolved-system overlay, not builder signature change.** Keep `buildCardsPrompt` etc. pure (so
  `previewPrompt` stays client-safe). In the action's non-override branch, build the prompt then replace
  `system` with `resolved[key]`. In the dialog, seed the textarea from the `systemDefault` prop. Same
  table → same value → invariant preserved.
- **Save = upsert-or-delete.** When the submitted system text equals the built-in constant for that key,
  DELETE the row instead of writing it — so the user never forks onto a frozen copy of the default and
  keeps inheriting future default changes. This is one pure decision (`system === BUILTIN[key]`) worth a
  unit test.

## Phase 1: Data layer

### Overview

The table, the resolver, the validation/helpers, and the schema-describe neutralization. No UI, no
actions yet.

### Changes Required

#### 1. Migration: `user_prompts` table + RLS

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_user_prompts.sql` (new)

**Intent**: Persist per-user system-prompt overrides, one row per (user, prompt key). Row absent = use
built-in default. Mirror the `user_settings` RLS style but add a DELETE policy (Reset deletes rows).

**Contract**: Table `user_prompts` — `user_id uuid references auth.users(id) on delete cascade default
auth.uid()`, `prompt_key text not null check (prompt_key in ('cards','notes_decompose','notes_topic'))`,
`system text not null`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null
default now()`. Primary key `(user_id, prompt_key)`. `enable row level security`. Four policies for
`authenticated`, all keyed `(select auth.uid()) = user_id`: select (using), insert (with check), update
(using + with check), **delete (using)**. If the repo's `auto_bump_updated_at` trigger
(`20260606083954`) is a generic per-table function, attach it for `updated_at`; otherwise set
`updated_at = now()` in the upsert.

#### 2. Regenerate DB types

**File**: `src/lib/supabase/types.ts` (regenerated)

**Intent**: Pick up the new table so the resolver/actions are typed.

**Contract**: Run `pnpm db:types` (requires local Supabase up + `supabase db reset` or `migration up` to
apply the new migration first). No hand edits.

#### 3. Prompt key, schema, and key-derivation helper

**File**: `src/features/openrouter/prompts.ts`

**Intent**: Add the typed key set, the save-validation schema, and a pure mapper from `previewInput` to
prompt key so the dialog can self-identify. Also export a `BUILTIN_SYSTEM` map for fallback + the
equals-default check.

**Contract**:

- `export type PromptKeyT = 'cards' | 'notes_decompose' | 'notes_topic'`.
- `export const BUILTIN_SYSTEM: Record<PromptKeyT, string>` = the three existing constants.
- `export function promptKeyFromPreviewInput(input: PreviewInputT): PromptKeyT` — `cards`→`'cards'`,
  notes+topic→`'notes_topic'`, notes text/file→`'notes_decompose'`.
- `export const userPromptSchema = z.object({ promptKey: z.enum([...]), system:
z.string().trim().min(1, 'Prompt is empty').max(MAX_PROMPT_CHARS) })` reusing `MAX_PROMPT_CHARS:15`.

#### 4. Resolver

**File**: `src/features/openrouter/queries.ts`

**Intent**: Read the current user's override rows (RLS-scoped) and return a full map with built-in
fallbacks.

**Contract**: `export async function getResolvedSystemPrompts(client?): Promise<Record<PromptKeyT,
string>>` — select `prompt_key, system` from `user_prompts` (no user_id filter; RLS scopes), reduce into
`{ ...BUILTIN_SYSTEM, [row.prompt_key]: row.system }`. Use `runTableQuery` (multi-row precedent:
`subjects/queries.ts:22-26`).

#### 5. Neutralize the card-count describe

**File**: `src/features/openrouter/ai-schemas.ts`

**Intent**: Remove the hidden second voice on card count so the (now user-owned) system prompt is the
single lever.

**Contract**: Change `:25` `.describe('3 to 7 recall cards covering the key ideas.')` →
`.describe('Recall cards covering the key ideas.')`. No length bounds added.

### Success Criteria

#### Automated Verification

- Migration applies cleanly: `supabase db reset` (local stack up)
- Types regenerate without error and include `user_prompts`: `pnpm db:types`
- Type checking passes: `pnpm typecheck` (or the project's tsc script)
- Linting passes: `pnpm lint`
- Existing unit tests pass: `pnpm test`

#### Manual Verification

- `user_prompts` row inserted via SQL is readable only by its owner (RLS) — spot-check with two accounts.

**Implementation Note**: After automated verification passes, pause for manual confirmation before
Phase 2.

---

## Phase 2: Server actions + generate wiring

### Overview

Save/Reset actions, and make the generate actions authoritative by overlaying the resolved system.

### Changes Required

#### 1. Save action

**File**: `src/features/openrouter/actions/save-user-prompt.ts` (new)

**Intent**: Persist (or clear) a user's system prompt for one key. Equals-default → delete (no fork).

**Contract**: `'use server'`. `saveUserPrompt(input: { promptKey, system }): Promise<ActionResultT>`.
Validate with `userPromptSchema`; get user via the established auth helper. If
`system.trim() === BUILTIN_SYSTEM[promptKey]` → delete the row; else upsert `{ user_id, prompt_key,
system, updated_at }` on conflict `(user_id, prompt_key)`. Follow `update-daily-goal.ts` shape
(`runTableAction` + `ActionResultT`). `revalidatePath` the four prompt-bearing routes (`/notes/new`,
`/notes/[id]` with `'page'`, `/import`, `/memory-cards/new`).

#### 2. Reset action

**File**: `src/features/openrouter/actions/reset-user-prompt.ts` (new)

**Intent**: Delete a user's override for one key → fall back to built-in.

**Contract**: `'use server'`. `resetUserPrompt(input: { promptKey: PromptKeyT }):
Promise<ActionResultT>`. Validate the key; delete the row (no-op if absent); same `revalidatePath` set.

#### 3. Overlay resolved system in generate actions

**File**: `src/features/openrouter/actions/generate-cards.ts`, `.../generate-notes.ts`

**Intent**: When no in-dialog override is sent, send the user's resolved system (not the constant).

**Contract**: In the non-`promptOverride` branch, after building the prompt, set `system =
(await getResolvedSystemPrompts(supabase))[key]` where `key` is the request's task key. The
`promptOverride` branch is unchanged (verbatim). The `prompt` (user-message) half is unchanged.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit tests pass: `pnpm test`

#### Manual Verification

- Insert a custom `cards` row via SQL → trigger card generation WITHOUT editing in-dialog → the custom
  system is used (verify via the generation debug `system` field / `log-generation`).
- Save action with text equal to the built-in deletes any existing row.

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Dialog component

### Overview

Seed from `systemDefault`, add the two persistence buttons, track the saved baseline. `systemDefault` is
optional (defaults to the built-in via `promptKeyFromPreviewInput`), so the dialog is fully functional
before Phase 4 threads real values.

### Changes Required

#### 1. Generate dialog: seeding + buttons

**File**: `src/features/openrouter/components/generate-dialog.tsx`

**Intent**: Persist the System-prompt edit. Replace the in-memory `Reset to default` with Save +
Reset(confirm). Seed the textarea from the saved value.

**Contract**:

- New prop `systemDefault?: string`.
- Derive `const promptKey = promptKeyFromPreviewInput(previewInput)`.
- `const seededSystem = systemDefault ?? BUILTIN_SYSTEM[promptKey]`; `defaults = { ...previewPrompt(...),
system: seededSystem }`. (`shown = override ?? defaults` unchanged.)
- `savedSystem` state initialized to `seededSystem` — the persisted baseline.
- **Save prompt** button: enabled when `shown.system.trim()` is non-empty and `!== savedSystem`. Click →
  `saveUserPrompt({ promptKey, system: shown.system })` inside a transition; on success set
  `savedSystem` to the normalized value (or `BUILTIN_SYSTEM[promptKey]` when it equalled the built-in)
  and toast; on error toast.
- **Reset prompt** button: shown when `savedSystem !== BUILTIN_SYSTEM[promptKey]`. Opens an AlertDialog
  confirm (reuse `ConfirmDeleteDialog` or `alert-dialog` primitives, modeled on
  `delete-account-dialog`): title "Reset to built-in prompt?", body "Your customized prompt will be
  permanently deleted and AI generation will use the built-in default again. This can't be undone." On
  confirm → `resetUserPrompt({ promptKey })`; on success set `savedSystem = BUILTIN_SYSTEM[promptKey]`,
  clear the system override so the textarea shows the built-in, toast.
- Removes the existing `:193-203` in-memory reset button. Prompt textarea (`:216`) unchanged.

#### 2. Pure helper for the save decision (testable)

**File**: `src/features/openrouter/prompts.ts` (or a small util)

**Intent**: Isolate the equals-default branch for unit testing.

**Contract**: `export function isBuiltinSystem(promptKey: PromptKeyT, system: string): boolean` =
`system.trim() === BUILTIN_SYSTEM[promptKey]`. Used by both the save action and (optionally) the dialog.

#### 3. Unit tests

**File**: `src/__tests__/user-prompts.test.ts` (new)

**Intent**: Cover the pure logic the mutation depends on.

**Contract**: Test (a) `getResolvedSystemPrompts` reduce logic with a stubbed row set → overridden key
returns row, others return built-in; (b) `isBuiltinSystem` true/false incl. whitespace trim; (c)
`promptKeyFromPreviewInput` for all four input shapes. Add the touched pure modules to the `stryker`
`mutate` glob in `stryker.config.json`.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- New + existing unit tests pass: `pnpm test`

#### Manual Verification

- In the dialog: edit cards system → Save → button disables; reopen dialog → edited text persists.
- Reset → AlertDialog appears → confirm → textarea reverts to built-in, Reset button hides.
- Editing the Prompt (user-message) half still behaves as a one-shot (not persisted).

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Call-site threading

### Overview

Resolve prompts at each page server boundary and thread `systemDefault` to each dialog through its
existing wrapper props.

### Changes Required

#### 1. Resolve at the four pages

**File**: `notes/[id]/page.tsx`, `notes/new/page.tsx`, `import/page.tsx`, `memory-cards/new/page.tsx`

**Intent**: Fetch the resolved map alongside the existing `getOpenRouterStatus()` and pass the relevant
key's value down.

**Contract**: Add `getResolvedSystemPrompts()` to each page's existing `Promise.all`. Pass the relevant
entry as a `systemDefault` prop into the wrapper that ultimately renders the dialog. Keys per site per
the call-site table above (`notes/new` renders two: a `notes_topic` for the topic generator and a
`cards` for the inline card field).

#### 2. Thread `systemDefault` through wrappers

**File**: `memory-cards/components/generate-cards-button.tsx`, `memory-cards/components/memory-cards-section.tsx`,
`notes/components/memory-cards-field.tsx`, `notes/components/note-form.tsx`,
`openrouter/components/topic-generator.tsx`, `import/components/import-panel.tsx`

**Intent**: Pass the new prop along the same chains that already pass `defaultModel`, into
`GenerateDialog`.

**Contract**: Add an optional `systemDefault?: string` prop to each intermediate wrapper and forward it
to `GenerateDialog`. No behavior change beyond prop plumbing.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit tests pass: `pnpm test`
- Production build succeeds: `pnpm build`

#### Manual Verification

- Save a custom cards prompt on note A's dialog → open note B's generate dialog → saved text is
  pre-filled (cross-surface persistence via the shared key).
- Save a `notes_topic` prompt → it does NOT change the cards prompt (keys are independent).
- Generate after saving (without re-editing) → output reflects the custom prompt.
- Reset → confirm → built-in returns everywhere that key is used.

**Implementation Note**: After automated verification, hand the browser flow to `/10x-e2e` per the
project test plan; do not author E2E inline here.

---

## Testing Strategy

### Unit Tests

- `getResolvedSystemPrompts` reduce (override vs fallback per key).
- `isBuiltinSystem` (equality incl. trim) — drives the save delete-vs-upsert branch.
- `promptKeyFromPreviewInput` for all four `previewInput` shapes.

### Integration / Manual

- Save → reopen → persisted; Reset → confirm → built-in; generate honors saved prompt without re-edit;
  per-key independence; RLS isolation across two accounts.

### E2E

- Deferred to `/10x-e2e` (browser flow): save → cross-surface reopen → generate → reset-confirm. Per the
  project test plan, not invented in this plan.

## Migration Notes

- New table only; no data backfill. Existing users start with zero override rows → built-in defaults
  (unchanged behavior). Apply locally via `supabase db reset` (rebuilds seed accounts too — see AGENTS.md)
  then `pnpm db:types`. Vercel preview/prod apply the migration on deploy.

## References

- Design spec: `context/changes/editable-system-prompts/design.md`
- Table/RLS template: `supabase/migrations/20260604122940_add_user_settings.sql`
- Action pattern: `src/features/settings/actions/update-daily-goal.ts`
- Destructive confirm: `src/features/account/components/delete-account-dialog.tsx` → `components/ui/confirm-delete-dialog.tsx`
- Prompt source of truth: `src/features/openrouter/prompts.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Data layer

#### Automated

- [x] 1.1 Migration applies cleanly (`supabase db reset`) — 17ff21e
- [x] 1.2 Types regenerate and include `user_prompts` (`pnpm db:types`) — 17ff21e
- [x] 1.3 Type checking passes — 17ff21e
- [x] 1.4 Linting passes — 17ff21e
- [x] 1.5 Existing unit tests pass — 17ff21e

#### Manual

- [x] 1.6 RLS isolation spot-checked across two accounts — 17ff21e

### Phase 2: Server actions + generate wiring

#### Automated

- [x] 2.1 Type checking passes — 004d998
- [x] 2.2 Linting passes — 004d998
- [x] 2.3 Unit tests pass — 004d998

#### Manual

- [ ] 2.4 Custom row used by generation without in-dialog edit (debug `system`)
- [ ] 2.5 Save with built-in text deletes the row

### Phase 3: Dialog component

#### Automated

- [x] 3.1 Type checking passes — ede188e
- [x] 3.2 Linting passes — ede188e
- [x] 3.3 New + existing unit tests pass — ede188e

#### Manual

- [ ] 3.4 Edit → Save → persists on reopen
- [ ] 3.5 Reset → AlertDialog → confirm → reverts to built-in
- [ ] 3.6 Prompt (user-message) half still one-shot

### Phase 4: Call-site threading

#### Automated

- [ ] 4.1 Type checking passes
- [ ] 4.2 Linting passes
- [ ] 4.3 Unit tests pass
- [ ] 4.4 Production build succeeds (`pnpm build`)

#### Manual

- [ ] 4.5 Cross-surface persistence (note A → note B)
- [ ] 4.6 Per-key independence (topic vs cards)
- [ ] 4.7 Generation honors saved prompt without re-edit
- [ ] 4.8 Reset-confirm returns built-in everywhere
