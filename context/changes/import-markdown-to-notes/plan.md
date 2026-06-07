# AI-Assisted Authoring (import + generate notes & cards) Implementation Plan

> Change-id `import-markdown-to-notes` is kept stable but understates scope — this is an
> AI-assisted authoring slice. See `change.md` "Scope reshape" for the five capabilities.

## Overview

Five authoring capabilities built on **two AI primitives** (`gen-notes`, `gen-cards`, each
usable grounded-from-source or ungrounded-from-a-topic) plus **one deterministic op** (`split`):

1. Cards from an existing note (`#1`, gen-cards grounded)
2. Stand-alone card on a topic (`#2`, gen-cards ungrounded)
3. Import doc / paste text → AI decomposes into **N** notes (`#3`, gen-notes grounded)
4. Import structured markdown → notes via heading-split, **no AI** (`#4`, split)
5. Note on a topic (`#5`, gen-notes ungrounded, single note)

All AI ops sit behind one **OpenRouter BYOK connect (OAuth PKCE)** — locked in `shape-notes.md`.
Built in 4 phases, each shipping through its own review→simplify→test→archive gate.

## Current State Analysis

- **Notes/subjects/cards** exist with full CRUD. A note has `{title, content?, subject_id?, position?}`;
  a card has `{prompt, example?, code_context?, note_id?, subject_id?}` (`memory_cards.note_id`
  became **nullable** + gained `subject_id` in `decouple_cards_from_notes` migration).
- **The card "answer" is `example`** — `review-panel.tsx:34-42` shows `prompt`, then a "Show answer"
  disclosure revealing `example` + `code_context`. There is no `answer` column and none is needed.
- **Atomic multi-row insert precedent**: `create_note_with_checks(p_note jsonb, p_checks jsonb)`
  RPC (`...create_note_with_checks_rpc.sql:16`) — inserts a note + array of cards in one txn, RLS-checked,
  fields extracted explicitly (no mass-assignment).
- **Heading-split reference**: `supabase/seed-scripts/generate-section-seed.mjs:50` `parseNoteSections`
  is **fence-aware** but **hard-coded to H1**. Generalize the level; reuse the fence-awareness.
- **Markdown pipeline** (`src/components/markdown/`): `EditorWithPreview`, `RenderMarkdown`,
  `MarkdownPreview`, shared `markdown-plugins.ts` (remark-gfm + Shiki). Reusable for note preview/edit.
- **Per-user setting precedent**: `user_settings` (RLS, FK-cascade clean on account-delete) + the
  upsert-based `update-daily-goal.ts:17` action. Model for credential + model-choice storage.
- **Account-delete** (`delete_account()` RPC) relies on **FK cascade to `auth.users`** — any new
  credential table with `references auth.users(id) on delete cascade` is cleaned automatically.
- **Supabase clients** (`src/lib/supabase/`): server (cookie/RLS) + browser, **anon key only, no
  service-role client**. Env validated by Zod in `src/lib/env.ts` (server secrets live here, sans
  `NEXT_PUBLIC_`).
- **No file-upload UI** anywhere; **no encryption-at-rest, no Supabase Vault** (pgcrypto present,
  used only for seed password hashing).
- **Action conventions**: `ActionResultT` (`src/types/action.ts`), `toastActionResult`
  (`components/forms/toast-result.ts`), `toastRedirect` (`src/lib/toast-redirect.ts`),
  `runTableAction` (`src/lib/supabase/run-table-action.ts`), `validateInput` (`src/lib/validate.ts`),
  TanStack `useAppForm` (`components/forms/hooks/form-hooks.ts`).

## Desired End State

A signed-in user can: deterministically import a structured `.md` file or pasted text into many
notes under a subject; connect their OpenRouter account once; then ask AI to (a) decompose an
unstructured document into multiple notes, (b) write a note on a topic, (c) generate recall cards
from a note, and (d) write a stand-alone card on a topic. Every AI output passes a preview/edit
gate before commit. Disconnecting/deleting the account removes the stored credential. Verify by
walking each of the five capabilities end-to-end on a production build.

### Key Discoveries

- `example` is the de-facto answer field (`review-panel.tsx:34-42`) — no schema change for cards.
- `create_note_with_checks` (`...create_note_with_checks_rpc.sql:16`) is the bulk-insert template;
  Phase 1 needs an N-note variant.
- OpenRouter PKCE (live-confirmed): `GET openrouter.ai/auth?callback_url=&code_challenge=&code_challenge_method=S256`
  → callback `?code=` → `POST openrouter.ai/api/v1/auth/keys {code, code_verifier}` → `{key, user_id}`,
  a **user-owned, revocable** key (no documented expiry). `code_verifier` must persist across the redirect.
- `@openrouter/ai-sdk-provider` (v0.7.5) + AI SDK `generateObject` with a Zod schema; construct
  `createOpenRouter({ apiKey: userKey })` **per request** (no documented per-call key override).
- Schema nullability for strict structured output: use `.nullable()`, not `.optional()`, to avoid
  `NoObjectGeneratedError` on some models.

## What We're NOT Doing

- **PDF / image / audio** read sources — explicitly future (separate slice). Phase 1 read stage is
  modeled pluggable so they're additive, but none are built here.
- **No `answer` column** on `memory_cards` — `example` serves that role.
- **No service-role client, no Supabase Vault** — app-level AES-GCM + RLS instead.
- **No dedup/merge on re-import** — preview is the guard; only a size cap.
- **No live OpenRouter `/models` fetch** — curated list only.
- **No conversational/chat AI surface** — single-shot structured-output actions only (change.md).
- **No `staleTimes`/caching work** (that's S-11), no changes to the FSRS recall loop or RLS model.

## Implementation Approach

Vertical, phase-by-phase. Phase 1 ships standalone user value with zero security surface. Phase 2
builds the shared OpenRouter connect (the gate) but ships no generation. Phases 3 and 4 each add one
AI primitive across its two entry points (grounded + ungrounded). Each AI op is a single-shot
Server Action → one `generateObject` call → the existing preview/edit gate → existing insert paths.

### Reference implementations (ai_devs — `/Users/konradantonik/workspace/ai_devs`)

Adapt, do not copy — neither is a turnkey OpenRouter-BYOK-via-PKCE:

- **OpenRouter client wiring** — `4th-devs/config.js` (baseURL, `OPENROUTER_API_KEY`,
  `EXTRA_API_HEADERS`, `provider/model` routing). CAVEAT: uses a **static `.env` operator key** —
  the plain-key model, NOT per-user OAuth. Good for _how to call_, not _how the user connects_.
- **Generic PKCE OAuth mechanics** — `4th-devs/04_05_apps/mcp/src/shared/oauth/{flow,discovery,cimd}.ts`
  - `storage/interface.ts` (`oauth4webapi`, code-challenge/verifier, callback, a `TokenStore`).
    CAVEAT: generic MCP OAuth assuming standard discovery; OpenRouter's PKCE is its own simpler custom
    flow (`auth?callback_url=&code_challenge=` → exchange at `/api/v1/auth/keys`) — confirm the live
    contract, don't transplant discovery.
- **Lesson index** — `zadania/episode-map.md`: **S01E01** structured generation + grounding +
  model selection; **S01E02 / S02E01** prompt caching (static system prompt, dynamic data in user
  message); **S01E05** cost / start-cheap-escalate.

---

## Phase 1: Deterministic markdown import (`#4`)

### Overview

Turn a structured `.md` file or pasted text into many notes under a subject — no AI, no credentials.
Establishes the importer surface, the level-split util, the bulk-insert RPC, and the preview/commit
pipeline that Phase 4 will reuse.

### Changes Required:

#### 1. Level-parametric, fence-aware markdown splitter

**File**: `src/features/import/utils/split-markdown.ts` (+ `src/__tests__/split-markdown.test.ts`)

**Intent**: Pure, unit-tested function that splits markdown into `{title, content}[]` at a chosen
heading level, ignoring `#` inside fenced code blocks. Generalizes `generate-section-seed.mjs:50`'s
H1-only logic to H1/H2/H3.

**Contract**: `splitMarkdown(md: string, level: 1 | 2 | 3): { title: string; content: string }[]`.
Fence-aware (track ` ``` ` open/close before treating `^#{level}\s` as a boundary). Content
before the first heading at that level becomes a leading untitled section (or is attached to the
first note — pick one, test it). Title = the heading text; content = everything until the next
same-level heading.

#### 2. Bulk-insert RPC

**File**: `supabase/migrations/<ts>_import_notes_rpc.sql`

**Intent**: Atomic insert of a subject (existing or new) + N notes under it, RLS-checked, modeled on
`create_note_with_checks`. Returns the subject id (and/or note ids) for the post-commit redirect.

**Contract**: `import_notes(p_subject jsonb, p_notes jsonb) returns uuid`. `p_subject` =
`{ id?: uuid, name?: text }` — if `id` present, reuse; else create. `p_notes` = `[{ title, content,
position }]`. Extract fields explicitly (no mass-assignment), iterate via `jsonb_array_elements`,
insert each note with the resolved `subject_id` and a fractional `position` (append-at-end). `security
invoker` so RLS applies; relies on the per-row `*_insert_own` policies.

#### 3. Import feature — action, schema, queries

**Files**: `src/features/import/actions/import-notes.ts`, `src/features/import/schemas.ts`

**Intent**: Server Action validating the preview payload and calling the RPC, then `toastRedirect`
to the new/target subject. Schema caps file size + section count.

**Contract**: `importNotes(input: unknown): Promise<ActionResultT>` taking `{ subject: {id?|name},
notes: {title, content}[] }`. Zod: reject `> N` notes / oversized content with a clear message
(constants in `src/features/import/constants.ts`). Mirror `create-note.ts` redirect/toast pattern.

#### 4. Import UI — upload/paste, level picker, editable preview, subject picker

**Files**: `src/features/import/components/import-panel.tsx`, `.../source-input.tsx`,
`.../note-preview-list.tsx`; route `src/app/(protected)/import/page.tsx`; nav entry in `app-nav`.

**Intent**: Client island: (a) source input — `.md/.markdown/.txt` file via `FileReader` (no storage
bucket) OR a paste textarea; (b) H-level radio (H1/H2/H3) that re-runs `splitMarkdown` live; (c) a
preview list of resulting notes, each title+body editable (reuse `EditorWithPreview`) and skippable;
(d) subject combobox (existing) or new-subject field defaulting to filename/H1. Submit → `importNotes`.

**Contract**: Split runs client-side for live preview; the committed payload is the (possibly edited)
preview, not a re-parse. Reuse the subjects combobox from `card-form.tsx` and the markdown editor
components. `data-testid`s per the E2E selector lesson (`import-source`, `import-level-h2`,
`import-note-row`, `import-commit`).

### Success Criteria:

#### Automated Verification:

- Splitter unit tests pass (fence-aware; H1/H2/H3; pre-heading content; empty/no-heading input): `pnpm test`
- Migration applies cleanly: `supabase db reset`
- Type checking passes (run `pnpm exec next typegen` first — new route): `pnpm typecheck`
- Linting passes: `pnpm lint`
- E2E: upload a fixture `.md`, pick a level, edit/skip a note, commit → notes appear under the subject: `pnpm test:e2e`
- Build passes: `pnpm build`

#### Manual Verification:

- A real `/workspace/learning` file imports into sensible notes at the chosen level.
- Oversized file / too many sections shows the cap message, not a crash.
- Pasted text (no file) imports identically.
- No regression to manual note creation.

**Implementation Note**: After automated verification passes, pause for human confirmation of manual
testing before Phase 2.

---

## Phase 2: OpenRouter connect — the shared AI gate

### Overview

Let a user connect their OpenRouter account via OAuth PKCE and store the returned key encrypted at
rest. No generation yet — this is the gate Phases 3–4 depend on. Account-delete must remove the key.

### Changes Required:

#### 1. Credential storage + crypto

**Files**: `supabase/migrations/<ts>_openrouter_credentials.sql`, `src/lib/crypto/aes-gcm.ts`,
addition to `src/lib/env.ts`.

**Intent**: Per-user table holding the AES-256-GCM-encrypted key + chosen model; a crypto util to
encrypt/decrypt server-side; a new server-only env secret for the master key.

**Contract**: Table `openrouter_credentials` — `user_id uuid pk references auth.users(id) on delete
cascade default auth.uid()`, `key_ciphertext text`, `key_iv text`, `key_auth_tag text`, `model text`,
`created_at/updated_at` (+ `moddatetime` trigger per the updated-at lesson). RLS select/insert/update
own (mirror `user_settings`). `aes-gcm.ts`: `encryptSecret(plain): {ciphertext, iv, authTag}` /
`decryptSecret(parts): string` using Node `crypto` `createCipheriv('aes-256-gcm', key, iv)`. Env:
`OPENROUTER_ENC_KEY` (32-byte, validated in `env.ts`). The key is **never** sent to the client.

#### 2. OAuth PKCE connect flow

**Files**: `src/features/openrouter/actions/connect.ts`, callback route
`src/app/api/openrouter/callback/route.ts`, `src/features/openrouter/pkce.ts`.

**Intent**: "Connect OpenRouter" starts PKCE: generate `code_verifier` + S256 `code_challenge`,
persist the verifier across the redirect, send the user to `openrouter.ai/auth`. The callback
exchanges `?code=` for the key, encrypts + stores it, redirects back to `/settings` with a toast.

**Contract**: Start: build `https://openrouter.ai/auth?callback_url=<SITE_URL>/api/openrouter/callback
&code_challenge=<S256>&code_challenge_method=S256`; store `code_verifier` server-side keyed to the
session (HttpOnly cookie or a short-lived row) — NOT client-readable. Callback (`route.ts` under
`src/app/api/` per AGENTS.md): read `code`, load+clear the verifier, `POST
https://openrouter.ai/api/v1/auth/keys` with `{ code, code_verifier, code_challenge_method:'S256' }`,
receive `{ key }`, `encryptSecret` + upsert into `openrouter_credentials`, `toastRedirect('/settings',
'openrouter-connected')`. Use `{{ .RedirectTo }}`-style origin care so the callback works on the
e2e port too (port-match lesson). Reference ai_devs `oauth/flow.ts` for verifier/challenge mechanics.

#### 3. Settings UI — connect / disconnect / status

**Files**: `src/features/openrouter/components/connect-card.tsx`, addition to the `/settings` page;
`src/features/openrouter/actions/disconnect.ts`; `src/features/openrouter/queries.ts`
(`isConnected(userId)`).

**Intent**: A settings card showing connection status with Connect / Disconnect. Disconnect deletes
the credential row.

**Contract**: `isConnected` returns boolean (row exists) — drives the gating in Phases 3–4.
Disconnect = delete own row (RLS). No key value ever leaves the server.

#### 4. Server-side OpenRouter client + curated models

**Files**: `src/features/openrouter/server-client.ts`, `src/features/openrouter/models.ts`.

**Intent**: A server-only factory that loads + decrypts the user's key and returns a configured
`createOpenRouter` instance; a curated model constant + a default.

**Contract**: `getOpenRouterForUser(userId): Promise<OpenRouterProvider | null>` (null if not
connected) — decrypts per request, sets `appName`/`appUrl` headers. `models.ts`: `OPENROUTER_MODELS`
(~5–8 `{id, label}`), `DEFAULT_MODEL`. Account-delete cleanup is automatic via the FK cascade
(verify, don't add code). Add `@openrouter/ai-sdk-provider` + `ai` deps via `pnpm add`.

### Success Criteria:

#### Automated Verification:

- `aes-gcm.ts` round-trip unit test (encrypt→decrypt === input; tampered tag throws): `pnpm test`
- Migration applies; `openrouter_credentials` RLS verified own-only: `supabase db reset`
- `delete_account()` removes the credential row (FK cascade) — assert in a test/migration check.
- Type/lint/build pass: `pnpm typecheck && pnpm lint && pnpm build`

#### Manual Verification:

- Connect flow completes against real OpenRouter; `/settings` shows connected; DB stores only ciphertext.
- Disconnect removes the row; status flips.
- Delete account → credential row gone.

**Implementation Note**: Pause for human confirmation (the live OAuth round-trip can't be fully E2E'd
locally) before Phase 3.

---

## Phase 3: gen-cards (`#1` grounded + `#2` ungrounded)

### Overview

The card primitive: generate `{cards:[{prompt, example}]}` from a note's prose (grounded, `#1`) or a
topic string (ungrounded, `#2`). Gated to connected users; preview-gated before insert.

### Changes Required:

#### 1. gen-cards action + schema

**Files**: `src/features/openrouter/actions/generate-cards.ts`, `src/features/openrouter/ai-schemas.ts`.

**Intent**: Single-shot `generateObject` producing card candidates from either a note id (load its
prose) or a topic string. Returns candidates to a preview — does **not** insert directly.

**Contract**: `generateCards({ source: {noteId} | {topic} }): Promise<ActionResult<CardCandidate[]>>`.
Zod output `z.object({ cards: z.array(z.object({ prompt: z.string(), example: z.string() })) })` —
fields `.nullable()` not `.optional()` (structured-output gotcha). Static system prompt + dynamic
content in the user message (prompt-cache lesson, S01E02). Grounding: instruct "derive only from the
provided text" for `#1`; for `#2` (ungrounded topic) lean on S01E01 grounding discipline. Guard:
return an error if `getOpenRouterForUser` is null.

#### 2. Wire `#1` into the note / card section

**Files**: addition to `src/features/memory-cards/components/` (the in-note cards section) — a
"Generate cards with AI" button (shown only when connected) → calls `generateCards({noteId})` → a
preview list (reuse the card form fields) → on accept, the existing `createMemoryCard` path per card
(or a small bulk insert), linking `note_id` + inherited `subject_id`.

**Intent**: Add the grounded entry point without disturbing manual card creation.

**Contract**: Button visibility driven by `isConnected`. Accepted cards go through validated inserts;
`example` holds the answer. `data-testid="cards-generate-ai"`.

#### 3. Wire `#2` into the standalone card form

**Files**: addition to `src/features/memory-cards/components/card-form.tsx` — an "AI / topic" mode
that calls `generateCards({topic})`, previews, and on accept fills the standalone create path
(`createStandaloneCard`, `note_id: null`, optional subject).

**Intent**: Add the ungrounded entry point to the existing standalone create surface.

**Contract**: Reuse the existing form for the editable preview; the topic field is the AI input.

### Success Criteria:

#### Automated Verification:

- ai-schema validation unit test (rejects malformed AI output shape): `pnpm test`
- Generated cards insert via the existing validated paths (no RLS bypass): covered by action tests.
- Type/lint/build pass.
- E2E (connected via a seeded/mocked credential): generate from a note → preview → accept → cards persist linked to the note.

#### Manual Verification:

- `#1`: cards generated from a real note are on-topic and answerable from that note.
- `#2`: a topic card is sensible; ungrounded hallucination is caught at preview.
- Button hidden when not connected.

**Implementation Note**: Pause for human confirmation before Phase 4.

---

## Phase 4: gen-notes (`#3` grounded multi-note + `#5` ungrounded single-note)

### Overview

The note primitive: decompose unstructured prose into **N** notes (grounded, `#3`) or write a single
note on a topic (ungrounded, `#5`). `#3` rides Phase 1's import surface as the AI read-strategy;
`#5` is a mode on the new-note flow. Gated + preview-gated.

### Changes Required:

#### 1. gen-notes action + schema

**Files**: `src/features/openrouter/actions/generate-notes.ts`, addition to `ai-schemas.ts`.

**Intent**: `generateObject` producing `{notes:[{title, content}]}` from prose (`#3`, expect N) or a
topic (`#5`, expect 1). Returns candidates to the preview, no direct insert.

**Contract**: `generateNotes({ source: {text} | {topic} }): Promise<ActionResult<NoteCandidate[]>>`.
Zod `z.object({ notes: z.array(z.object({ title: z.string(), content: z.string() })) })`. For `#3`
the prompt instructs topic-decomposition into multiple coherent notes; for `#5`, a single focused
note. Static system prompt, dynamic input in user message. Null-guard on connection.

#### 2. Wire `#3` into the import surface

**Files**: addition to `src/features/import/components/import-panel.tsx` — when the source is
unstructured (or the user picks "AI decompose"), call `generateNotes({text})` and feed the result
into the **same** `note-preview-list` + subject picker + `importNotes` commit from Phase 1.

**Intent**: AI becomes the second read-strategy; everything after preview is shared with `#4`.

**Contract**: AI path shown only when connected. A degenerate single-note result triggers a gentle
nudge ("looks like one note — just create one?"), not a block.

#### 3. Wire `#5` into the new-note flow

**Files**: addition to the note-create surface (`src/features/notes/components/note-form.tsx` or a
sibling) — a "Generate with AI" mode taking a topic → `generateNotes({topic})` → fills the note form
for edit → existing create path.

**Intent**: Ungrounded single-note generation on the existing create surface.

**Contract**: Reuse `note-form` for the editable preview; topic field is the AI input.

### Success Criteria:

#### Automated Verification:

- ai-schema unit test for note shape: `pnpm test`
- `#3` commits through the Phase-1 `importNotes` RPC path (shared); `#5` through the create path.
- Type/lint/build pass.
- E2E (connected): paste prose → AI decompose → preview shows >1 note → commit → notes persist under the subject.

#### Manual Verification:

- `#3`: a real unstructured doc decomposes into sensible multiple notes.
- `#5`: a topic note is coherent; editable before save.
- Both hidden when not connected.

**Implementation Note**: After Phase 4, run the full slice gate and archive.

---

## Testing Strategy

### Unit Tests

- `split-markdown.ts`: fence-awareness, each heading level, pre-heading content, no-heading/empty input.
- `aes-gcm.ts`: encrypt/decrypt round-trip; tampered auth-tag throws.
- AI output Zod schemas: accept valid shapes, reject malformed.

### Integration / E2E

- Phase 1: file + paste import end-to-end (deterministic, no connection needed).
- Phases 3–4: gated paths with a seeded credential (encrypt a throwaway key into
  `openrouter_credentials` in the E2E seed) — assert preview→accept→persist, and that ungated UI is
  hidden when no credential. Mock or stub the OpenRouter HTTP call in E2E to keep tests deterministic
  and avoid real spend.

### Manual

- The live OAuth round-trip (Phase 2) is manual — it can't be fully driven locally.
- Per capability (#1–#5): generate → inspect at preview → commit → verify persistence + linkage.

## Performance Considerations

- AI calls are single-shot, user-initiated, behind a button — no hot path. Apply the prompt-cache
  discipline (static system prompt, dynamic data in the user message; S01E02) so repeated runs over
  the same large doc are cheap.
- Client-side `FileReader` + client-side split keep import off the server until commit.

## Migration Notes

- Two new tables (`openrouter_credentials`) + one RPC (`import_notes`); both RLS-scoped and
  FK-cascade to `auth.users`. `supabase db reset` rebuilds local; account-delete cleanup is by cascade.
- New deps: `@openrouter/ai-sdk-provider`, `ai` (check `pnpm-workspace.yaml` `allowBuilds` if either
  ships a build script). New env secret `OPENROUTER_ENC_KEY` — add via `vercel env add` for
  prod+preview, and to `.env.local` for dev (per AGENTS.md env ritual).

## References

- Change identity + scope reshape: `context/changes/import-markdown-to-notes/change.md`
- Bulk-insert precedent: `supabase/migrations/...create_note_with_checks_rpc.sql:16`
- Heading-split reference: `supabase/seed-scripts/generate-section-seed.mjs:50`
- Answer-is-`example`: `src/features/review/components/review-panel.tsx:34`
- Setting/upsert precedent: `src/features/settings/actions/update-daily-goal.ts:17`
- ai_devs: `4th-devs/config.js` (client), `4th-devs/04_05_apps/mcp/src/shared/oauth/flow.ts` (PKCE),
  `zadania/episode-map.md` (S01E01/S01E02/S01E05)
- Lessons that bind here: `updated_at` trigger, E2E port-match for callbacks, `z.guid()` for DB ids,
  E2E selector = `data-testid`, `next typegen` before typecheck on new routes.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Deterministic markdown import

#### Automated

- [x] 1.1 Splitter unit tests pass (fence-aware; H1/H2/H3; pre-heading; empty) — 4650dfc
- [x] 1.2 Migration applies cleanly (`supabase db reset`) — 4650dfc
- [x] 1.3 Type checking passes (after `next typegen`) — 4650dfc
- [x] 1.4 Linting passes — 4650dfc
- [x] 1.5 E2E import (upload + paste) passes — 4650dfc
- [x] 1.6 Build passes — 4650dfc

#### Manual

- [ ] 1.7 Real `/workspace/learning` file imports into sensible notes at chosen level
- [ ] 1.8 Oversized file shows cap message, no crash
- [ ] 1.9 Pasted text imports identically
- [ ] 1.10 No regression to manual note creation

### Phase 2: OpenRouter connect

#### Automated

- [x] 2.1 `aes-gcm.ts` round-trip + tamper test passes
- [x] 2.2 Migration applies; `openrouter_credentials` RLS own-only verified
- [x] 2.3 `delete_account()` removes the credential row (cascade) verified
- [x] 2.4 Type/lint/build pass

#### Manual

- [ ] 2.5 Connect flow completes; `/settings` shows connected; DB stores only ciphertext
- [ ] 2.6 Disconnect removes the row; status flips
- [ ] 2.7 Delete account → credential row gone

### Phase 3: gen-cards (#1 + #2)

#### Automated

- [ ] 3.1 ai-schema validation unit test passes
- [ ] 3.2 Generated cards insert via existing validated paths
- [ ] 3.3 Type/lint/build pass
- [ ] 3.4 E2E: generate from a note → preview → accept → persist linked to note

#### Manual

- [ ] 3.5 `#1` cards on-topic and answerable from the note
- [ ] 3.6 `#2` topic card sensible; hallucination caught at preview
- [ ] 3.7 Button hidden when not connected

### Phase 4: gen-notes (#3 + #5)

#### Automated

- [ ] 4.1 ai-schema note-shape unit test passes
- [ ] 4.2 `#3` commits through Phase-1 RPC; `#5` through create path
- [ ] 4.3 Type/lint/build pass
- [ ] 4.4 E2E: paste prose → decompose → preview >1 note → commit → persist

#### Manual

- [ ] 4.5 Real unstructured doc decomposes into sensible multiple notes
- [ ] 4.6 `#5` topic note coherent; editable before save
- [ ] 4.7 Both hidden when not connected
