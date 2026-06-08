# AI Generation Robustness Implementation Plan

## Overview

Harden the single-shot AI generation workflow (`src/features/openrouter/`) against **silent failures** before E2E/manual testing begins. Today a generation can return `success: true` with zero or blank cards (no-op on Apply, no error), and every real failure — bad key, rate limit, malformed output, hung model — collapses to one generic string. **And every outcome is silent to the user**: success shows only a token line + Apply button trapped inside the dialog, Apply fills the destination fields/list with no notification at all, and failures surface as an in-dialog `FormError` that's easy to miss. This plan makes each of those loud and actionable, without changing the workflow's altitude (it stays a one-call-per-generation workflow; no agents, no loops).

## Current State Analysis

- **Empty-result asymmetry.** `generate-notes.ts:97` guards `object.notes.length === 0` and returns a friendly error; **`generate-cards.ts` has no equivalent**. A `{ cards: [] }` returns `success: true`; `topic-generator.tsx:51` (`data[0] && onResult(data[0])`) then silently no-ops on Apply.
- **Schema accepts garbage that validates.** `ai-schemas.ts` uses bare `z.string()` — `""` passes, so a blank card/note saves silently. No `.describe()` on any field (the only steering is the system prompt; ref ai_devs S01E01: schema descriptions steer generation).
- **All failures look identical.** Both actions catch and return `"AI generation failed. Try again."` (`generate-cards.ts:86`, `generate-notes.ts:119`) — no distinction between 401/403 (bad key), 402 (credits), 429 (rate limit), 5xx (transient), malformed output, or timeout.
- **No timeout.** Neither action bounds `generateObject`; a hung model spins "Generating…" indefinitely.
- **No outcome feedback (discoverability).** `GenerateDialog.generate()` sets `result`/`error` into dialog-local state only; `apply()` calls `onResult(data)` and closes with no signal. Across all four callers — `generate-cards-button.tsx` (candidate list below the trigger), `note-form.tsx` (#5 fills Title/Content fields), `card-form.tsx` (#2 fills Question/Example fields), `import-panel.tsx` (fills the drafts preview) — the result appears in a surface the user wasn't looking at. The toast infra already exists and is used on _save_ (`toastActionResult` → `toastMessage` from `@/components/toasts`, body-level portal that renders above the dialog) but **never on generate/apply**.

### Key Discoveries:

- AI SDK v6.0.197 verified: `APICallError.isInstance(err)` + `err.statusCode`, and `NoObjectGeneratedError.isInstance(err)` both exist; `generateObject` accepts `abortSignal`.
- The notes empty-guard pattern (`generate-notes.ts:97`) is the template to mirror for cards.
- The `GenerateResultT` envelope (`types.ts:16`) already carries an `error` string — typed messages flow through it with **zero UI change**.
- Existing schema tests (`ai-schemas.test.ts`) use no empty strings, so any tightening is test-safe.

## Desired End State

- A generation that yields no usable items returns `{ success: false, error: <friendly, specific> }` — never a silent `success: true` no-op.
- Items with a blank required field are dropped; the user gets the valid remainder, or a friendly error if none remain.
- Each failure class surfaces a distinct, actionable message (reconnect / wait / insufficient credits / timed out / bad shape).
- A generation cannot hang past 60s.
- **Every generation outcome toasts**: success ("Generated N …"), failure (the classified message), and Apply (a caller-supplied hint pointing at where the result landed) — so no outcome is silent regardless of which surface the user is on.
- Verify: unit tests for the two new pure helpers pass; manual dialog runs show the right message per failure class; manual runs show success/failure/apply toasts on every surface.

## What We're NOT Doing

- **No observability** (Langfuse-style tracing/prompt-versioning) — deferred; the local `.ai-debug/` log stays the record.
- **No max-steps / agentic loop caps** — there are no loops; one `generateObject` = one step. Correctly absent.
- **No automated feedback/self-correction loop** (LLM-judge, retry-on-bad-output) — the human review-before-save IS the verification layer.
- **No app-level rate limiting** — cost (user's own credits) + the connect gate are the brakes; revisit only if abuse appears.
- **No schema-level count/length bounds** — the ≥1 invariant is enforced at runtime so the friendly message survives (see Critical Implementation Details). "3 to 7 cards" stays advisory in the prompt.
- **No retry-on-transient** — the SDK's default `maxRetries: 2` already covers transient API errors; we only classify the final thrown error.

## Implementation Approach

Three phases, each independently testable. Phase 1 makes the **output** trustworthy (drop blanks, never return empty silently). Phase 2 makes **failures** legible (typed messages, hard timeout). Phase 1+2 push logic to runtime in the two server actions and two small pure helpers under `utils/`, keeping the schema declarative and the UI untouched. Phase 3 makes every outcome **visible** — wiring the existing toast helper into `GenerateDialog` (success/failure on generate, a caller-supplied hint on apply) so the result is never silent on any of the four surfaces.

## Critical Implementation Details

- **The ≥1-item invariant is enforced at runtime, NOT via `z.array().min(1)`.** A schema `.min(1)` makes `generateObject` throw `NoObjectGeneratedError` on an empty result, which the catch collapses to a generic message. Keeping the array permissive lets the action inspect the (post-filter) length and return a _specific_ friendly error — mirroring the existing `generate-notes.ts:97` guard. This ordering is the whole point; do not "tighten" the schema array later.
- **`AbortSignal.timeout()`** (Node 18+, we're on 24) throws a `TimeoutError`-named error on expiry; the error classifier matches on `error.name` (`TimeoutError`/`AbortError`) since it isn't an `APICallError`.

## Phase 1: Output integrity

### Overview

Stop blank/empty output from silently reaching the preview/save path. Add field descriptions, drop incomplete items, and give cards the empty-guard that notes already has.

### Changes Required:

#### 1. Schema field descriptions

**File**: `src/features/openrouter/ai-schemas.ts`

**Intent**: Steer generation and document the contract by adding `.describe()` to every field and array (ref S01E01). No `.min`/length bounds — runtime owns emptiness.

**Contract**: `prompt`, `example`, `title`, `content` each gain a one-line `.describe()`; `cards`/`notes` arrays gain a `.describe()` naming the expected set ("3 to 7 recall cards", "one note per distinct topic"). Field shapes (`z.string()`, `z.array(...)`) unchanged. Update the file's lead comment to note that emptiness/quality is enforced at runtime, not here.

#### 2. Incomplete-item filters (new pure helpers)

**File**: `src/features/openrouter/utils/sanitize-generated.ts` (new)

**Intent**: Drop generated items missing a required text field, so one blank item doesn't poison a batch. Pure + unit-testable.

**Contract**: Export `keepCompleteCards(cards: GeneratedCardT[]): GeneratedCardT[]` (keeps items where `prompt` and `example` are non-empty after trim) and `keepCompleteNotes(notes: GeneratedNoteT[]): GeneratedNoteT[]` (title + content non-empty after trim).

#### 3. Cards action: filter + empty-guard

**File**: `src/features/openrouter/actions/generate-cards.ts`

**Intent**: Run the model output through `keepCompleteCards`; if nothing usable remains, return a friendly error instead of an empty success. Mirror the notes guard.

**Contract**: After `generateObject`, `const cards = keepCompleteCards(object.cards)`; if `cards.length === 0` return `{ success: false, error: "Couldn't generate any usable cards — try a more detailed note or topic." }`. Return `data: cards`. Pass the dropped count to `logGeneration` (so the drop isn't invisible in the log channel).

#### 4. Notes action: filter before the existing guard

**File**: `src/features/openrouter/actions/generate-notes.ts`

**Intent**: Apply `keepCompleteNotes` so the existing `length === 0` guard also catches the all-blank case; keep the scanned-PDF wording.

**Contract**: `const notes = keepCompleteNotes(object.notes)` before the empty check; the existing zero-length branch now tests the filtered list and returns `data: notes`. Log dropped count alongside the existing entry.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- New unit tests for `keepCompleteCards`/`keepCompleteNotes` pass: `pnpm test`
- Existing `ai-schemas.test.ts` stays green: `pnpm test`

#### Manual Verification:

- Generate cards from a thin topic; if the model emits a blank field that card is dropped, the rest apply.
- Force an empty result (e.g. nonsense topic); the dialog shows the friendly "no usable cards" error, not a silent no-op on Apply.

**Implementation Note**: After Phase 1 automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Failure surfacing

### Overview

Turn the single generic failure string into class-specific, actionable messages, and cap generation time.

### Changes Required:

#### 1. Timeout constant

**File**: `src/features/openrouter/constants.ts` (new)

**Intent**: Single home for the generation deadline.

**Contract**: `export const GENERATION_TIMEOUT_MS = 60_000`.

#### 2. Error classifier (new pure helper)

**File**: `src/features/openrouter/utils/describe-generation-error.ts` (new)

**Intent**: Map a thrown generation error to a user-facing, actionable message. Pure + unit-testable.

**Contract**: `describeGenerationError(error: unknown): string`, ordered most-specific first — timeout/abort (`error.name` is `TimeoutError`/`AbortError`) → "timed out, try again or pick a faster model"; `NoObjectGeneratedError.isInstance` → "model didn't return the expected shape"; `APICallError.isInstance` switch on `statusCode`: 401/403 → "reconnect OpenRouter in Settings", 402 → "insufficient credits", 429 → "rate-limited, wait a moment", 408/5xx → "temporary error, try again"; fallback → the current generic string. Imports `APICallError`, `NoObjectGeneratedError` from `ai`.

#### 3. Wire timeout + classifier into both actions

**File**: `src/features/openrouter/actions/generate-cards.ts`, `src/features/openrouter/actions/generate-notes.ts`

**Intent**: Bound the call and replace the generic catch string.

**Contract**: Add `abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS)` to each `generateObject` call; in each `catch`, replace `'AI generation failed. Try again.'` with `describeGenerationError(error)` (keep the existing `console.error`).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit test for `describeGenerationError` (status → message mapping, timeout, bad-shape, fallback) passes: `pnpm test`

#### Manual Verification:

- Disconnect / use an invalid key → dialog shows the reconnect message, not the generic one.
- Force a timeout (temporarily tiny `GENERATION_TIMEOUT_MS`, or a slow model) → dialog shows the timeout message and the spinner resolves.

**Implementation Note**: After Phase 2 automated verification passes, pause for manual confirmation, then proceed to the slice review gate.

---

## Phase 3: Outcome visibility (toasts)

### Overview

Make every generation outcome visible no matter which surface the user is on. Wire the existing `toastMessage` helper into the single shared `GenerateDialog` so success and failure toast on generate, and a caller-supplied hint toasts on apply (the silent moment where the dialog closes and the result lands in fields/lists the user wasn't watching). One dialog change covers all four callers; each caller supplies its own nouns/hints.

### Changes Required:

#### 1. Toast generate success + failure (shared dialog)

**File**: `src/features/openrouter/components/generate-dialog.tsx`

**Intent**: Surface the generation outcome above the dialog (the toast portal renders at body level, so it's visible even when the user's focus has drifted off the dialog).

**Contract**: Add two optional props — `resultNoun: string` (singular, e.g. `"note"`, `"card"`) and `applyHint?: string`. In `generate()`, after the outcome resolves: on success, `toastMessage(\`Generated ${outcome.data.length} ${outcome.data.length === 1 ? resultNoun : resultNoun + 's'}\`, 'success')`; on failure, `toastMessage(outcome.error, 'error')`(keep the inline`FormError`too — it's the persistent in-dialog record). Import`toastMessage`from`@/components/toasts`. `resultNoun`defaults to`'item'` so existing call sites compile, but every caller sets it.

#### 2. Toast the apply hint (shared dialog)

**File**: `src/features/openrouter/components/generate-dialog.tsx`

**Intent**: Kill the fully-silent moment — Apply closes the dialog and drops the result into a surface the user wasn't watching.

**Contract**: In `apply()`, after `onResult(result.data)`, if `applyHint` is set, `toastMessage(applyHint, 'info')`. Callers whose result lands in an obvious, in-view place may omit it; the four current callers all set it (their destinations are below-the-fold or in a now-closed dialog's place).

#### 3. Each caller supplies noun + apply hint

**Files**: `src/features/memory-cards/components/generate-cards-button.tsx`, `src/features/notes/components/note-form.tsx` (via `topic-generator.tsx`), `src/features/memory-cards/components/card-form.tsx` (via `topic-generator.tsx`), `src/features/import/components/import-panel.tsx`

**Intent**: Give each surface accurate wording for where its result went.

**Contract**: Thread `resultNoun` + `applyHint` through. `TopicGenerator` gains matching pass-through props (it wraps `GenerateDialog`). Hints, by surface:

- #1 cards-from-note → noun `"card"`, hint `"Cards ready below — review, then Add to save."`
- #5 note-from-topic → noun `"note"`, hint `"Note filled in below — edit if needed, then Create note to save."`
- #2 card-from-topic → noun `"card"`, hint `"Card filled in below — edit if needed, then Create card to save."`
- #4 decompose → noun `"note"`, hint `"Notes ready in the preview below — review, then Import to save."`

These hints all reinforce the load-bearing fact the user was missing: **generation fills a form/list; nothing is saved until the explicit Save/Add/Create/Import step.**

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Existing tests stay green: `pnpm test`

#### Manual Verification:

- Generate a note from a topic → success toast fires; on Apply, the "Note filled in below…" toast fires and the Title/Content fields are populated.
- Trigger a failure (invalid key) → an error toast fires in addition to the in-dialog message.
- Repeat on all four surfaces → the noun and apply hint match the surface.

**Implementation Note**: After Phase 3 automated verification passes, pause for manual confirmation, then proceed to the slice review gate.

---

## Testing Strategy

### Unit Tests:

- `keepCompleteCards`/`keepCompleteNotes`: drops blank/whitespace-only fields, keeps complete items, empty-in → empty-out.
- `describeGenerationError`: each status code → expected message; timeout name; `NoObjectGeneratedError`; unknown → fallback.

### Integration Tests:

- None new — the AI-integration boundary is exercised by the existing manual/E2E flows; these guards are unit-level.

### Manual Testing Steps:

1. Thin topic → confirm blank items dropped, valid ones apply.
2. Nonsense/empty-yield input → friendly "no usable cards/notes" error.
3. Invalid OpenRouter key → reconnect message.
4. Temporarily shrink the timeout → timeout message; spinner clears.

## References

- Change identity: `context/changes/ai-generation-robustness/change.md`
- Empty-guard template: `src/features/openrouter/actions/generate-notes.ts:97`
- Result envelope: `src/features/openrouter/types.ts:16`
- ai_devs reference: S01E01 (structured output / schema descriptions), S01E05 (limits, status-code branching)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Output integrity

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck` — dd724f3
- [x] 1.2 Linting passes: `pnpm lint` — dd724f3
- [x] 1.3 New unit tests for `keepCompleteCards`/`keepCompleteNotes` pass: `pnpm test` — dd724f3
- [x] 1.4 Existing `ai-schemas.test.ts` stays green: `pnpm test` — dd724f3

#### Manual

- [ ] 1.5 Blank-field card dropped; remaining cards apply
- [ ] 1.6 Empty-yield input shows friendly "no usable cards" error (no silent no-op)

### Phase 2: Failure surfacing

#### Automated

- [x] 2.1 Type checking passes: `pnpm typecheck` — b4b6ea5
- [x] 2.2 Linting passes: `pnpm lint` — b4b6ea5
- [x] 2.3 Unit test for `describeGenerationError` passes: `pnpm test` — b4b6ea5

#### Manual

- [ ] 2.4 Invalid key shows reconnect message
- [ ] 2.5 Forced timeout shows timeout message and spinner clears

### Phase 3: Outcome visibility (toasts)

#### Automated

- [x] 3.1 Type checking passes: `pnpm typecheck` — 9f9b9d0
- [x] 3.2 Linting passes: `pnpm lint` — 9f9b9d0
- [x] 3.3 Existing tests stay green: `pnpm test` — 9f9b9d0

#### Manual

- [ ] 3.4 Generate success toast fires; Apply hint toast fires and fields/list populate
- [ ] 3.5 Failure toast fires alongside the in-dialog message
- [ ] 3.6 Noun + apply hint match the surface across all four callers
