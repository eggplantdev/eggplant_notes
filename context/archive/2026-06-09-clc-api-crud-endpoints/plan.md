# CLC Token API — Full CRUD (read-back, create-subject, update, delete) Implementation Plan

## Overview

Extend the CLC personal-token HTTP API from its current write-only-append surface (POST notes, POST memory-cards, GET subject/note lists) into full CRUD: read a single note with its cards, list cards with filters, create and update subjects, update notes and cards (including subject-switching), and delete all three entities. Ownership stays automatic via the RLS-scoped client every route already mints. The subject-switching paths must reproduce the app's app-enforced "linked card shares its note's subject" invariant exactly, so the move/unlink logic is extracted into shared cores rather than duplicated.

## Current State Analysis

- **Auth pipeline (reused as-is):** every route calls `authenticateRequest(request)` → Bearer → `resolve_api_token` RPC → minted user JWT → `auth.supabase` (RLS-scoped client) + `auth.userId`. `src/features/api-tokens/authenticate-request.ts`. No manual `user_id` filtering, no service-role.
- **Existing routes:** `src/app/api/notes/route.ts` (POST create + GET list), `src/app/api/memory-cards/route.ts` (POST only), `src/app/api/subjects/route.ts` (GET list only). Reads are done inline against `auth.supabase` (see `GET /api/notes` at `notes/route.ts:41`), NOT via the cookie-bound `queries.ts` helpers.
- **Write cores already injectable:** `insertNoteWithChecks`, `insertCardsForNote`, `insertStandaloneCard` take a `supabase` client — the POST routes call these. This is the pattern to mirror for updates.
- **Update logic is NOT injectable yet:** `updateNote` (`src/features/notes/actions/update-note.ts`) and `updateMemoryCard` (`src/features/memory-cards/actions/update-memory-card.ts`) are `'use server'` actions that internally `createClient()` (cookie session) AND call `revalidatePath`/`toastRedirect`. They cannot be called from an API route.
- **Helpers ready to reuse:** `errorJson`, `authError`, `readJsonBody` (`src/features/api-tokens/route-helpers.ts`); API body schemas live in `src/features/api-tokens/schemas.ts` (e.g. `noteAttachCardsSchema`).
- **Integration test harness exists:** `pnpm test:integration` runs `src/__tests__/api-routes.integration.test.ts`. Skill-doc drift is pinned by `src/__tests__/skill-template.test.ts`.

### Key Discoveries:

- **The link/unlink invariant is app-enforced, not DB-enforced** — migration `supabase/migrations/20260606161054_decouple_cards_from_notes.sql:3-5` states "No triggers — the app owns every write to subject_id." An attached card (`note_id` set) must have `subject_id == its note's subject`; a standalone card (`note_id` null) owns its subject freely.
- **Move-a-note card fan-out** lives at `update-note.ts:60-85`: `move` = `update({subject_id}).eq('note_id', id).in('id', ids)`; `unlink` = `update({note_id: null}).eq('note_id', id).in('id', ids)`. Applied only when the subject actually changed.
- **Position invariant** (`update-note.ts:46`): `notes.position` is null IFF `subject_id` is null. On subject change the action sets `position = Date.now()` (to a subject) or `null` (to None). Any note-subject write must preserve this.
- **Forced-unlink on card subject change** (`update-memory-card.ts:33`): the UI computes `unlinkFromNote` in the form (`card-form.tsx:87-92`) and the action does `{...patch, note_id: null}`. The API has no form, so the route must compute this server-side.
- **FK cascade behavior:** `memory_cards.note_id` → `ON DELETE CASCADE` (delete a note → its cards go); `notes.subject_id` and `memory_cards.subject_id` → `ON DELETE SET NULL` (delete a subject → members detach to unfiled). Deletes need no app-side fan-out.
- **`createSubject` exists** (`src/features/subjects/actions/create-subject.ts`, schema `subjectInputSchema = {title, description}`) but is cookie-bound; extract a core.

## Desired End State

An agent holding a `clc_` token can, over HTTP, read a note's full content + its cards, list cards by note/subject/unfiled, create and rename subjects, edit notes and cards, switch subjects (with the same linked/unlinked semantics the UI enforces), and delete any entity — all scoped to its own data by RLS. The downloadable skill documents every endpoint, including a loud linked/unlinked section, and the pinning test guards against doc drift. The existing UI (server actions) behaves identically, now delegating its update/create logic to the shared cores.

Verify: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration && pnpm build` all green; manual curl of each new endpoint with a real token returns the documented shapes; the UI note/card edit + subject-move flows still work.

## What We're NOT Doing

- No new auth model, no service-role, no changes to `authenticateRequest`.
- No DB migration, no triggers — the invariant stays app-enforced.
- No partial-field PATCH for cards: `PATCH /api/memory-cards/:id` takes the full editable field set (`cardWithSubjectSchema`), mirroring the action. (Notes are naturally partial on `subject_id` via `noteInputSchema`.)
- No bulk/batch update or delete endpoints.
- No pagination/search on `GET /api/memory-cards` beyond the note/subject/unfiled filters (the list endpoints are agent-oriented, not UI-paged).
- No change to the FSRS scheduling columns via the API.

## Implementation Approach

Two phases, split by whether the link/unlink invariant is touched. **Phase 1** adds endpoints with zero invariant logic (reads, create/update/delete subject, deletes of note/card) — these are inline RLS selects/deletes or a trivial subject core. **Phase 2** does the core extraction refactor (update logic out of the two server actions into injectable cores) and the subject-switching PATCH endpoints, where correctness matters.

Routes follow App-Router file conventions: collection routes stay in `.../route.ts`; per-id routes go in `.../[id]/route.ts`. Cores live at the feature root beside the existing `insert-*` cores. New API body schemas go in `src/features/api-tokens/schemas.ts`.

## Critical Implementation Details

- **Move-all default is a route concern, not a core change.** Keep `updateNoteCore`'s existing guard (apply card actions only when subject actually changed AND `cardActions` provided). In `PATCH /api/notes/:id`, when the body sets `subject_id` but omits `card_actions`, the route first reads the note's currently-linked card ids (`select id where note_id = :id`) and constructs `cardActions = { move: <those ids>, unlink: [] }` before calling the core. This realizes "cards come with the note" without changing UI behavior.
- **Forced-unlink is computed in the route.** `PATCH /api/memory-cards/:id` reads the card's current `note_id` + `subject_id`, then passes `unlinkFromNote = current.note_id != null && body.subject_id !== current.subject_id` to `updateMemoryCardCore`. Mirrors `card-form.tsx:87-92` server-side.
- **404 vs RLS.** A row the token's user doesn't own is invisible under RLS — a select/update/delete returns no row, indistinguishable from "doesn't exist." Treat both as `404` (do not leak existence). Use `.select('id').maybeSingle()` after update/delete and 404 when null.

---

## Phase 1: Reads, create/update/delete subject, delete note & card

### Overview

Add every endpoint that carries no link/unlink invariant. All ownership via RLS; cascades via FK.

### Changes Required:

#### 1. Single-note read-back (+ cards)

**File**: `src/app/api/notes/[id]/route.ts` (new — GET handler; PATCH/DELETE added in later changes/phase)

**Intent**: Let an agent read a note's full `content` and its cards back — closes the verify gap where the API could write code but never read it.

**Contract**: `GET /api/notes/:id` → authenticate; validate `:id` as uuid (else 400); `select id,title,content,subject_id from notes where id=:id` (RLS-scoped) `.maybeSingle()` → 404 if null; `select id,prompt,example,code_context,subject_id,note_id from memory_cards where note_id=:id`; respond `200 { note: {...}, cards: [...] }`.

#### 2. List memory cards with filters

**File**: `src/app/api/memory-cards/route.ts` (add GET; POST already present)

**Intent**: Read cards back, filtered, so an agent can dedup/inspect before writing.

**Contract**: `GET /api/memory-cards` with optional `?note=<uuid>` (filter `note_id`), `?subject=<uuid>` (filter `subject_id`), `?unfiled=true` (filter `subject_id is null`). Malformed uuid → 400. RLS-scoped select of `id,prompt,example,code_context,note_id,subject_id`; respond `200 { cards: [...] }`.

#### 3. Create subject

**File**: `src/app/api/subjects/route.ts` (add POST; GET already present)
**File**: `src/features/subjects/create-subject-core.ts` (new — `createSubjectCore(supabase, input)`)

**Intent**: First-class subject creation over the API (today a subject can only be born as a side effect of `POST /api/notes` with `subject_title`).

**Contract**: extract the insert from `create-subject.ts` into `createSubjectCore(supabase, data): Promise<{id}>`; refactor the action to call it then revalidate. Route: validate `subjectInputSchema` ({title, description?}); `createSubjectCore(auth.supabase, data)`; respond `201 { id }`.

#### 4. Update subject

**File**: `src/app/api/subjects/[id]/route.ts` (new — PATCH handler; DELETE below)
**File**: `src/features/subjects/update-subject-core.ts` (new — `updateSubjectCore(supabase, id, input)`)

**Intent**: Rename / re-describe a subject over the API.

**Contract**: extract update logic from `update-subject.ts` into a client-injectable core; action wraps. Route: validate subject id + `subjectInputSchema`; call core; `.maybeSingle()` → 404 if null; respond `200 { id }`.

#### 5. Delete note, card, subject

**File**: `src/app/api/notes/[id]/route.ts` (add DELETE) · `src/app/api/memory-cards/[id]/route.ts` (new — DELETE; PATCH in Phase 2) · `src/app/api/subjects/[id]/route.ts` (add DELETE)

**Intent**: Full removal over the API. Cascades/SET-NULL are DB-handled, so these are thin.

**Contract**: each — authenticate; validate uuid; `from(table).delete().eq('id', :id).select('id').maybeSingle()` (RLS-scoped) → 404 if null; respond `200 { id }`. Note-delete cascades its cards (FK); subject-delete SET-NULLs member notes/cards (FK). No app-side fan-out.

#### 6. Document Phase-1 endpoints in the skill

**File**: `context/changes/cli-token-ui-and-skill-download/clc-note-api.skill.md` (source of truth) → regen `src/features/api-tokens/skill-template.ts`
**File**: `src/__tests__/skill-template.test.ts` (extend the pinned-endpoint list)

**Intent**: Keep the downloadable skill complete and drift-guarded.

**Contract**: add `GET /api/notes/:id`, `GET /api/memory-cards`, `POST /api/subjects`, `PATCH /api/subjects/:id`, and the three `DELETE`s with request/response examples + a loud note that note-delete cascades cards and subject-delete unfiles members. Regenerate via `node context/changes/cli-token-ui-and-skill-download/gen-skill-template.mjs`. Extend the test's documented-endpoint assertions.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit tests pass: `pnpm test`
- Integration tests pass: `pnpm test:integration`
- Skill-template pinning test passes (new endpoints asserted): `pnpm test src/__tests__/skill-template.test.ts`
- Production build succeeds: `pnpm build`

#### Manual Verification:

- `GET /api/notes/:id` with a real token returns the note's `content` + cards; a random/other-user uuid returns 404.
- `GET /api/memory-cards?note=…` / `?subject=…` / `?unfiled=true` each return the right subset.
- `POST /api/subjects` then `GET /api/subjects` shows the new subject; `PATCH` renames it.
- `DELETE` a note → its cards disappear (`GET /api/memory-cards?note=…` empty); `DELETE` a subject → its notes/cards survive but show `subject_id: null`.
- Existing UI subject create/rename still works (cores refactor).

**Implementation Note**: After Phase 1 automated verification passes, pause for human confirmation of the manual checks before starting Phase 2.

---

## Phase 2: Note & card updates with subject-switching (the invariant)

### Overview

Extract the update logic into shared cores and expose the PATCH endpoints, reproducing the move-all / forced-unlink semantics non-interactively.

### Changes Required:

#### 1. Extract `updateNoteCore`

**File**: `src/features/notes/update-note-core.ts` (new) · refactor `src/features/notes/actions/update-note.ts`

**Intent**: Move the patch derivation, subject-change detection, position rule, and card move/unlink fan-out into a client-injectable core so the API and the UI action share one implementation of the invariant.

**Contract**: `updateNoteCore(supabase, id, input, cardActions?): Promise<{ id } | { error }>` — everything in `update-note.ts:24-85` except `revalidatePath`/`toastRedirect`. The action becomes: validate → `updateNoteCore(await createClient(), …)` → revalidate/redirect. Behavior (incl. the "apply card actions only on real subject change" guard and `position = Date.now()|null`) must be unchanged — the existing action tests are the contract.

#### 2. Extract `updateMemoryCardCore`

**File**: `src/features/memory-cards/update-memory-card-core.ts` (new) · refactor `src/features/memory-cards/actions/update-memory-card.ts`

**Intent**: Same treatment for the card update + forced-unlink write.

**Contract**: `updateMemoryCardCore(supabase, id, input, unlinkFromNote): Promise<{ id } | { error }>` — body of `update-memory-card.ts:20-43` minus revalidate/redirect. Action wraps.

#### 3. `PATCH /api/notes/:id`

**File**: `src/app/api/notes/[id]/route.ts` (add PATCH) · new body schema in `src/features/api-tokens/schemas.ts`

**Intent**: Edit a note's title/content/subject and move it between subjects with explicit or default card handling.

**Contract**: body schema `patchNoteBodySchema = noteInputSchema.extend({ card_actions: z.object({ move: z.array(uuid), unlink: z.array(uuid) }).optional() })`. Route: validate id + body; if `subject_id` provided and `card_actions` omitted → read linked card ids, build `{move: ids, unlink: []}` (move-all default, see Critical Details); call `updateNoteCore`; 404 if the note row isn't owned; `200 { id }`.

#### 4. `PATCH /api/memory-cards/:id`

**File**: `src/app/api/memory-cards/[id]/route.ts` (add PATCH; DELETE from Phase 1)

**Intent**: Edit a card and switch its subject, auto-unlinking from its note when an attached card's subject changes.

**Contract**: validate id + `cardWithSubjectSchema`; read current `note_id`+`subject_id`; compute `unlinkFromNote` (see Critical Details); call `updateMemoryCardCore`; 404 if not owned; `200 { id }`.

#### 5. Skill: the linked/unlinked section + PATCH docs

**File**: `clc-note-api.skill.md` → regen `skill-template.ts` · extend `skill-template.test.ts`

**Intent**: Teach the agent the invariant explicitly so it can predict what subject-switching does.

**Contract**: add `PATCH /api/notes/:id` (with `card_actions` shape + the move-all default) and `PATCH /api/memory-cards/:id`, plus a "Linked vs standalone cards" section: an attached card shares its note's subject; PATCHing an attached card's subject **unlinks it** (becomes standalone); moving a note moves its cards by default unless `card_actions` says otherwise. Regen + extend the pinning test.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit tests pass (incl. unchanged `updateNote`/`updateMemoryCard` action tests after refactor): `pnpm test`
- Integration tests pass (new PATCH endpoints incl. move-all + forced-unlink): `pnpm test:integration`
- Skill-template pinning test passes: `pnpm test src/__tests__/skill-template.test.ts`
- Production build succeeds: `pnpm build`

#### Manual Verification:

- `PATCH /api/notes/:id` changing `subject_id` with no `card_actions` → all linked cards report the new `subject_id` (via `GET /api/notes/:id`), still linked.
- `PATCH /api/notes/:id` with `card_actions.unlink` → those cards have `note_id: null` and keep their old subject.
- `PATCH /api/memory-cards/:id` changing an attached card's subject → card's `note_id` becomes null (unlinked); changing only prompt/example/code_context leaves the link intact.
- In the UI: edit a note (title/content), move a note between subjects with the card dialog, and edit a card's subject — all behave exactly as before the core extraction.

**Implementation Note**: After Phase 2 automated verification passes, pause for human confirmation before the slice-review-gate / archive.

---

## Testing Strategy

### Unit Tests:

- `updateNoteCore`: subject-unchanged edit doesn't touch position or cards; subject change sets position and applies move/unlink; move updates `subject_id` on the named linked cards only; unlink nulls `note_id`.
- `updateMemoryCardCore`: `unlinkFromNote` adds `note_id: null` to the patch; otherwise leaves the link.
- New API body schemas (`patchNoteBodySchema`, `card_actions` shape): reject malformed uuids / wrong types.
- `createSubjectCore` / `updateSubjectCore`: insert/update shape.

### Integration Tests (`api-routes.integration.test.ts`):

- Each new endpoint: happy path + 401 (no/bad token) + 404 (other-user/nonexistent id) + 400 (malformed uuid/body).
- Read-back: `GET /api/notes/:id` returns content + cards.
- Move-all default: PATCH note subject without `card_actions` → linked cards moved, still linked.
- Forced unlink: PATCH attached card's subject → `note_id` null.
- Delete cascade: DELETE note → cards gone; DELETE subject → member notes/cards survive with null subject.

### Manual Testing Steps:

1. Mint a token; run the per-endpoint curls above.
2. Exercise the UI note/card edit + note-move dialog to confirm the core refactor is behavior-preserving.

## Migration Notes

None — no schema change. The cores are a behavior-preserving refactor of existing actions; the action tests are the regression guard.

## References

- Change identity + verified research notes: `context/changes/clc-api-crud-endpoints/change.md`
- Prior change (token API + skill download + the fence-the-code skill fix): `context/changes/cli-token-ui-and-skill-download/`
- Patterns to mirror: `src/app/api/notes/route.ts` (inline RLS select), `src/features/notes/insert-note-with-checks.ts` (injectable core), `src/features/api-tokens/route-helpers.ts`
- Invariant source: `supabase/migrations/20260606161054_decouple_cards_from_notes.sql`, `src/features/notes/actions/update-note.ts:60-85`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Reads, create/update/delete subject, delete note & card

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck`
- [x] 1.2 Linting passes: `pnpm lint`
- [x] 1.3 Unit tests pass: `pnpm test`
- [x] 1.4 Integration tests pass: `pnpm test:integration`
- [x] 1.5 Skill-template pinning test passes: `pnpm test src/__tests__/skill-template.test.ts`
- [x] 1.6 Production build succeeds: `pnpm build`

#### Manual

- [x] 1.7 `GET /api/notes/:id` returns content + cards; other-user/nonexistent id → 404 — integration-covered (real Postgres+RLS: read-back content+cards, 404 isolation)
- [x] 1.8 `GET /api/memory-cards` note/subject/unfiled filters return correct subsets — integration-covered (all three filters)
- [x] 1.9 `POST` + `PATCH` subject create/rename works; visible in `GET /api/subjects` — integration-covered
- [x] 1.10 DELETE note cascades cards; DELETE subject unfiles members (subject_id null) — integration-covered (cascade-on-note-delete, unfile-on-subject-delete, double-delete→404)
- [x] 1.11 Existing UI subject create/rename still works after core refactor — E2E-verified (`subjects.spec.ts` green; fixed a pre-existing stale `createAssignedNote` helper unrelated to this change)

> Residual gap (not blocking): the only thing 1.7–1.10's integration tests don't touch is a real `clc_` token over HTTP — worth one `curl` pass before relying on the endpoints in production.

### Phase 2: Note & card updates with subject-switching

#### Automated

- [x] 2.1 Type checking passes: `pnpm typecheck` — a4bb2e6
- [x] 2.2 Linting passes: `pnpm lint` — a4bb2e6
- [x] 2.3 Unit tests pass (incl. unchanged action tests): `pnpm test` — a4bb2e6
- [x] 2.4 Integration tests pass (move-all + forced-unlink): `pnpm test:integration` — a4bb2e6
- [x] 2.5 Skill-template pinning test passes: `pnpm test src/__tests__/skill-template.test.ts` — a4bb2e6
- [x] 2.6 Production build succeeds: `pnpm build` — a4bb2e6

#### Manual

- [x] 2.7 PATCH note subject (no card_actions) → linked cards moved, still linked — integration-covered (move-all default reads back subject_id + note_id) — a4bb2e6
- [x] 2.8 PATCH note with card_actions.unlink → those cards note_id null, old subject kept — integration-covered — a4bb2e6
- [x] 2.9 PATCH attached card's subject → unlinked (note_id null); field-only edit keeps link — integration-covered (forced-unlink + field-only) — a4bb2e6
- [x] 2.10 UI note/card edit + note-move dialog behave identically post-refactor — E2E-verified (`notes.spec.ts` green; the 2 late-run failures were a server-died `ERR_CONNECTION_REFUSED`, confirmed passing on isolated re-run) — a4bb2e6
