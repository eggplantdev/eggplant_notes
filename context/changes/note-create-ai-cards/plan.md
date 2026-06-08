# Inline AI Card Generation (create-note) — Plan

## Overview

Add an AI "Generate cards" affordance to the create-note form's inline `MemoryCardsField`, grounded on
the note the user is currently writing. One new server-side source variant + one client integration;
reuses the shared `GenerateDialog` and the existing atomic create-note-with-checks save.

## Current State

- `generateCards` (`actions/generate-cards.ts`) accepts `{ noteId }` (grounded, RLS re-fetch) or
  `{ topic ≤200 }` (ungrounded). No path for arbitrary in-progress note text.
- `MemoryCardsField` (`features/notes/components/memory-cards-field.tsx`) is a `withForm` array field
  with only a manual "Add card" button. Staged rows save atomically with the note.
- `GenerateCardsButton` is the template: `previewInput={{ task:'cards', material: cardsMaterialFromNote(...) }}`,
  `action={(m,p)=>generateCards({noteId,...})}`, result → candidate list. We mirror it but ground on the
  draft and push into the form array.
- `cardsMaterialFromNote({title, content})` + `PreviewInputT = { task:'cards'; material: string }` already
  accept arbitrary material — no prompt changes needed.

## What We're NOT Doing

- No change to how checks persist (the create-note-with-checks RPC already does it atomically).
- No grounding on a saved note (existing detail-page flow covers that).
- No new prompt/system text — `cardsMaterialFromNote` + `buildCardsPrompt` are reused as-is.

## Phase 1: draftNote source variant + inline button

### Changes Required

#### 1. `generateCards` draftNote variant

**File**: `src/features/openrouter/actions/generate-cards.ts`

**Contract**: Add a third union member to `sourceSchema`: `{ draftNote: { title: z.string().max(200),
content: z.string().trim().min(1,'Add note content first').max(50_000) }, modelId?, promptOverride? }`.
In the non-override material branch, add `else if ('draftNote' in source) material =
cardsMaterialFromNote(source.draftNote)` before the topic fallback. No other action logic changes
(filter/guard/timeout/classifier from the ai-generation-robustness change all still apply).

#### 2. Inline generate button in `MemoryCardsField`

**File**: `src/features/notes/components/memory-cards-field.tsx`

**Contract**: Add `aiEnabled?: boolean` + `defaultModel?: string` to the `withForm` `props`. Read the
form's reactive `title`/`content` via `useStore(form.store, …)`. Next to "Add card", render
`GenerateDialog<GeneratedCardT>` with: `connected={aiEnabled}`, `defaultModel`, `previewInput={{ task:
'cards', material: cardsMaterialFromNote({title, content}) }}`, `action={(modelId, promptOverride) =>
generateCards({ draftNote: { title, content }, modelId, promptOverride })}`, `onResult={(cards) =>
cards.forEach(c => checksField.pushValue({ prompt: c.prompt, example: c.example, code_context: '' }))}`,
`validate={() => content.trim() ? undefined : 'Add note content first.'}`, `resultNoun="card"`,
`applyHint="Cards added below — edit if needed, then Create note to save."`, `triggerLabel="Generate
cards with AI"`, `triggerTestId="note-cards-generate-ai"`, `dialogTitle="Generate cards from this note"`.

#### 3. Thread props from `NoteForm`

**File**: `src/features/notes/components/note-form.tsx`

**Contract**: Pass `aiEnabled={props.aiEnabled ?? false}` and `defaultModel={props.defaultModel}` to
`<MemoryCardsField …>` (create mode only — it's already gated on `!note`).

### Success Criteria

#### Automated

- `pnpm typecheck`, `pnpm lint`, `pnpm test` green.

#### Manual

- On New Note: write content → "Generate cards with AI" → cards appear as staged rows → Create note saves them.
- Empty content → trigger shows "Add note content first." beside the button (no dialog).
- Not connected → trigger opens the connect gate.

## Progress

> `- [ ]` pending, `- [x]` done; append ` — <sha>` when a step lands.

### Phase 1: draftNote variant + inline button

#### Automated

- [x] 1.1 `pnpm typecheck` passes
- [x] 1.2 `pnpm lint` passes
- [x] 1.3 `pnpm test` stays green

#### Manual

- [ ] 1.4 Generate cards from in-progress content → staged rows appear → Create note saves them
- [ ] 1.5 Empty content → "Add note content first." beside the button
- [ ] 1.6 Not connected → connect gate opens
