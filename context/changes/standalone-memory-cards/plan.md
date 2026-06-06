# Standalone Memory Cards — Implementation Plan

## Overview

Let users create a memory card **without** first authoring a note, edit any card (content **and** subject) from one place, and manage the card↔note link from both sides. A "New card" entry point appears on the dashboard (next to "New note") and on `/memory-cards`.

To make this clean rather than hacked, we **decouple cards from notes**: `memory_cards.note_id` becomes nullable, and a card gains its own `subject_id`. **A card's subject is a first-class, app-owned property of the card** (single source of truth for reads); the note link survives as **optional source context** that can be added at creation and removed later. There are **no DB triggers** — the app owns every write to `subject_id`, and the only cross-entity behavior (moving linked cards when a note's subject changes) is an **explicit, user-confirmed** bulk action, not a silent cascade.

## Current State Analysis

- **A card cannot exist without a note today.** `memory_cards.note_id` is `NOT NULL FK → notes(id) ON DELETE CASCADE` (`supabase/migrations/20260603070945_init_notes_memory_cards_review_events.sql:46-57`).
- **A card has no subject of its own.** Subject is derived through the note (`notes.subject_id`). The list query joins notes with `notes!inner` and filters on `notes.subject_id` (`src/features/memory-cards/queries.ts:62-94`, esp. `:76` and `:81`).
- **Creation is note-coupled.** `createMemoryCard(noteId, input)` requires a note id (`src/features/memory-cards/actions/create-memory-card.ts:15-31`); the only create UI is the in-note inline add (`memory-cards-section.tsx`, `add-memory-card.tsx`).
- **Editing lives on the note page.** `memoryCardEditHref(noteId, id)` → `/notes/[id]?edit=<id>#memory-card-form` (`utils/memory-card-edit-href.ts`); the note detail page resolves `?edit=<cardId>` and renders `MemoryCardForm` in edit mode inside `MemoryCardsSection` (`notes/[id]/page.tsx:95-99`, `memory-cards-section.tsx:33-37`). **Standalone cards have no note page → no edit surface today.** `MemoryCardForm` is already create-AND-edit capable (keys on the `card` prop, `memory-card-form.tsx:34-59`) but has **no subject field**.
- **Several read paths and UI assume `note_id` is non-null** (`queries.ts:76`, `memory-cards-list.tsx:21,24,25`, `review-panel.tsx:30`, `source-note-link.tsx:5,17`, `hardest-cards.tsx:17`, `dashboard/stats.ts:69-70`, `dashboard/types.ts:22`).
- **Note edit already isolates the subject-change moment.** `updateNote` re-reads the note's own `subject_id` to decide whether to re-derive `position` (`notes/actions/update-note.ts:30-40`) — the exact hook point for the "move linked cards too?" prompt. The edit form (`note-form.tsx`) is a client component, so it can host a confirm dialog before submit.
- **Entry points**: dashboard "New note" at `dashboard/page.tsx:48`; `/memory-cards` page exists with a `PageShell`; nav has a "Memory cards" item. No `/review` route — review is embedded on the dashboard via `ReviewPanel`.
- **Reusable pieces**: single-select subject `Combobox` + `NO_SUBJECT='none'` sentinel (`note-form.tsx:25,110-125`); the `/notes/new` route + `NoteForm` pattern; the card fields (`prompt`, `example`, `code_context`) in `memory-card-form.tsx:80-114`; `useAppForm` (`components/forms/hooks/form-hooks.ts:8`); subjects query `getSubjects` (`features/subjects/queries.ts`).
- **Data is disposable** — the local DB is wiped via `supabase db reset` constantly, so no existing-row backfill is needed; the seed (`supabase/seed.sql`) regenerates everything and provides `note_id` on every card.

## Desired End State

- `memory_cards.note_id` is nullable; `memory_cards.subject_id` exists (nullable FK → subjects, `ON DELETE SET NULL`), with RLS enforcing subject ownership. **No triggers.**
- A "New card" button on the dashboard and on `/memory-cards` opens `/memory-cards/new`, a form with a subject picker + card fields + a short explainer of the two ways to make a card. Submitting creates a note-less card and lands on `/memory-cards`.
- **One edit surface for every card:** `/memory-cards/[id]/edit` edits content **and** subject for linked and standalone cards alike. The note-page `?edit=<cardId>` inline edit is removed; `memoryCardEditHref(id)` points at the route for all cards. The note page keeps inline **add**.
- **Link management both ways:** the card edit page shows its source note (if any) with an **Unlink** button (`note_id → null`); the note detail card section shows an **Unlink** button per card (same write, note side). Unlinking keeps the card and its subject.
- **Note-subject change is user-confirmed, not cascaded:** editing a note's subject, when the note has linked cards, prompts _"Move its N cards to the new subject too?"_ — on confirm, one bulk update moves them; otherwise they keep their current subject.
- A standalone card reviews normally (FSRS), shows no source-note link, and is deletable. The `/memory-cards` subject filter works for standalone cards (keys off `memory_cards.subject_id`).

**Verify**: create a card from the dashboard with no note → it appears in `/memory-cards` under the chosen subject (or unfiled), reviews on the dashboard with no source-note link, edits (content + subject) via `/memory-cards/[id]/edit`, and deletes. Link a card to a note (in-note add) → edit it → unlink → it survives as standalone with its subject intact. Change a note's subject with linked cards → confirm prompt moves them; decline → they stay. `/notes` is never polluted with phantom notes.

### Key Discoveries

- Single-source subject avoids the dual-source smell: reads always use `memory_cards.subject_id` — _simpler_ queries (join notes only for the optional title). (`queries.ts:62-94`)
- **No triggers — app owns subject writes.** The original trigger design was abandoned: it can't coexist with editable subjects (a sync trigger would overwrite the user's edit). The one cross-entity behavior (note-subject → cards) is an explicit confirmed bulk update, which is _also_ the only correct UX once subjects are editable.
- RLS subject-ownership pattern to mirror exactly: notes' policies at `supabase/migrations/20260603151508_add_subjects_and_note_ordering.sql:59-86`.
- `MemoryCardForm` is already create+edit capable but note-coupled and subject-less; the route form is a sibling, not a rewrite of it (`memory-card-form.tsx` stays the in-note **add** form).
- `DueCardT` is already typed `notes: … | null` defensively (`types.ts:5-12`) — the review path mostly tolerates a null note; the list path does not (`notes!inner`).
- `updateNote` already re-reads its own subject to gate `position` re-derivation (`update-note.ts:30-40`) — extend that same branch for the bulk-move.
- Lessons that bite here: new route → run `pnpm exec next typegen` before `pnpm typecheck`; validate DB ids with `z.guid()` not `z.uuid()`; `updated_at` is DB-owned (never hand-stamp); E2E uses `data-testid`; bracket route paths need `:(literal)` for git.

## What We're NOT Doing

- **The card↔note relationship is one note → many cards** — each card has a single `note_id` (its source note), unlinkable to null; a note has many cards (already shown in `MemoryCardsSection`). We are not adding a card-to-many-notes join table.
- **No DB triggers** for subject sync. Replaced by app-level seeding (create) + a confirmed bulk move (note-subject edit).
- **No data backfill** of existing cards' `subject_id` — data is wiped via `db reset`; the seed regenerates it. (Update the seed so linked seed cards carry `subject_id` = their note's subject.)
- **No subject picker on the in-note inline Add-card form** — a card added from a note is seeded with that note's subject; the user changes it later via the card edit page if desired. The picker lives on the standalone create + the unified edit form.
- **No new `/review` or `/cards` routes** — entry is `/memory-cards/new` and `/memory-cards/[id]/edit`.

## Implementation Approach

Four phases, DB-up: (1) schema + RLS + read-path/type updates + app-level subject seeding so the data model supports note-less, subject-owning cards without breaking existing flows; (2) the unified create + edit surface (standalone create, edit-any route, the shared route form, unlink-from-card-side, and removal of the note-page inline edit); (3) entry-point buttons + null-note handling across list/stats/delete; (4) note-side link management — the confirmed bulk-move on note-subject change and per-card unlink in the note's card section. Each phase is independently verifiable (typecheck/lint/build + `db reset`).

## Critical Implementation Details

- **App owns `subject_id`; no triggers.** `createMemoryCard(noteId, …)` (in-note add) seeds `subject_id` from the note's subject at insert time (a default, not a lock). `createStandaloneCard` takes the subject directly. `updateMemoryCard` writes whatever `subject_id` the edit form submits. RLS — not a trigger — guarantees the subject is owned by the user.
- **Two card forms, distinct roles.** `memory-card-form.tsx` stays the **in-note inline add** form (create-only after this change; no subject picker). The new `card-form.tsx` is the **route form** for `/memory-cards/new` (standalone create) and `/memory-cards/[id]/edit` (edit any card) — subject picker + card fields + (edit-only) source-note + unlink. Don't fold one into the other; keep each thin.
- **Regenerate Supabase types after the migration** (`supabase gen types typescript --local > <the generated Database types file>`), then `MemoryCardT`/`DueCardT`/`MemoryCardListItemT` pick up nullable `note_id` + new `subject_id`. Do this before `pnpm typecheck`.

---

## Phase 1: Decouple the data model (schema, RLS, read paths, app-level seeding)

### Overview

Make `note_id` nullable, add `subject_id`, enforce subject ownership in RLS, seed a linked card's subject from its note in the create action, and update read queries + types so existing list/review/stats paths keep working with the new shape. **No triggers.**

### Changes Required

#### 1. Migration — decouple cards from notes

**File**: `supabase/migrations/<timestamp>_decouple_cards_from_notes.sql` (new)

**Intent**: Allow note-less cards and give cards their own owned subject.

**Contract**:

- `alter table memory_cards alter column note_id drop not null;`
- `alter table memory_cards add column subject_id uuid references subjects(id) on delete set null;`
- `create index memory_cards_subject_id_idx on memory_cards (subject_id);` (the list subject-filter now keys off this). Keep `memory_cards_note_id_idx` — still used by the note-detail card fetch.
- Replace the `memory_cards` INSERT and UPDATE RLS policies to add the subject-ownership check, mirroring notes (`20260603151508…:59-86`):
  ```sql
  drop policy "memory_cards_insert_own" on memory_cards;
  create policy "memory_cards_insert_own" on memory_cards
    for insert to authenticated
    with check (
      (select auth.uid()) = user_id
      and (subject_id is null or exists (
        select 1 from subjects s where s.id = subject_id and s.user_id = (select auth.uid())))
    );
  -- same subject-ownership shape for memory_cards_update_own (using + with check)
  ```
- **No trigger functions.** (The earlier insert-stamp / cascade triggers are intentionally omitted.)

#### 2. Seed update

**File**: `supabase/seed.sql` (+ the generator `supabase/seed-scripts/generate-section-seed.mjs` if it emits the card inserts)

**Intent**: Linked seed cards carry `subject_id` = their note's subject (no trigger to do it now).

**Contract**: Set `subject_id` on each seeded `memory_cards` insert from the owning note's subject. Mind the existing `dev@example.com` double-insert trap (no `on conflict` guard) — refresh via `db reset`, not re-applying the seed (AGENTS.md).

#### 3. Seed subject in the in-note create action

**File**: `src/features/memory-cards/actions/create-memory-card.ts`

**Intent**: A card added from a note defaults to that note's subject (app-level, replacing the dropped insert trigger).

**Contract**: Before insert, read the note's `subject_id` (RLS-scoped `select subject_id from notes where id = noteId`) and include it in the inserted row. Keep `note_id = noteId`. This is a default seed, not a lock — the user can change it later in card edit.

#### 4. List + due + stats queries

**File**: `src/features/memory-cards/queries.ts`

**Intent**: Read subject from the card, not through a forced note join; tolerate null notes.

**Contract**:

- `getMemoryCardsList` (`:62-94`): change `notes!inner(title, subjects(title))` → outer `notes(title)`, and project the card's own subject via the new FK: `subject_id, subjects(title)`. Switch the subject filter (`:81`) from `notes.subject_id` to `memory_cards.subject_id`.
- `getDueQueue` (`:21-37`): already outer `notes(...)` — confirm it compiles against nullable `note_id`.
- `getCardsForStats` (`:46-50`): unchanged (selects `note_id`; null tolerated downstream in Phase 3).
- `getMemoryCardsForNote`: unchanged (note-scoped fetch still valid).

#### 5. Types

**File**: `src/features/memory-cards/types.ts`

**Intent**: Reflect nullable `note_id` and card-owned subject.

**Contract**: `MemoryCardListItemT` — `note_id: string | null`, `notes` stays `| null`, surface the card's subject (`subjects: { title } | null` hanging off the card). `DueCardT` — already `notes … | null`; no change beyond the regenerated `MemoryCardT` having nullable `note_id` + `subject_id`. Regenerate the `Database` types first.

### Success Criteria

#### Automated Verification

- Migration + reseed applies cleanly: `supabase db reset`
- Supabase types regenerated and committed
- Type check passes: `pnpm exec next typegen && pnpm typecheck`
- Lint passes: `pnpm lint`
- Build passes: `pnpm build`

#### Manual Verification

- Existing `/memory-cards` list still renders seeded cards with their subject and (when present) note title.
- A card added from a note (in-note add) lands with `subject_id` = the note's subject (inspect the row).
- The `/memory-cards` subject filter returns cards by `memory_cards.subject_id`.

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Unified create + edit surface (route form, standalone create, edit-any, unlink)

### Overview

Add the note-less create path and the single edit surface for all cards. One route form (`card-form.tsx`) backs both `/memory-cards/new` and `/memory-cards/[id]/edit`. `updateMemoryCard` gains `subject_id`. The card edit page shows + unlinks its source note. The note-page `?edit=<cardId>` inline edit is removed and the edit href repointed.

### Changes Required

#### 1. Schemas

**File**: `src/features/memory-cards/schemas.ts`

**Contract**: `cardWithSubjectSchema = memoryCardInputSchema.extend({ subject_id: z.guid().nullable() })` (reuse `promptSchema`/`optionalText`; `z.guid()` per the id lesson, nullable since subject is optional). Export `CardWithSubjectInputT`. Used by both standalone create and edit.

#### 2. Actions

**Files**:

- `src/features/memory-cards/actions/create-standalone-card.ts` (new) — `createStandaloneCard(input: unknown)`: validate against `cardWithSubjectSchema`, insert `{ prompt, example, code_context, subject_id, note_id: null }` (user_id from `auth.uid()`; RLS enforces subject ownership). `revalidatePath('/memory-cards')`, then `toastRedirect('/memory-cards', …)` (mirror `create-note.ts`).
- `src/features/memory-cards/actions/update-memory-card.ts` — extend to write `subject_id`. **Signature change:** `updateMemoryCard(id: string, input: unknown)` (drop the `noteId` first param — edit is no longer note-scoped). Validate `id` (`memoryCardIdSchema`) + body (`cardWithSubjectSchema`). Re-fetch the card's `note_id` (RLS-scoped) to revalidate the right note path when present. Always `revalidatePath('/memory-cards')`; `revalidatePath('/notes/${noteId}')` only if linked. `toastRedirect('/memory-cards', …)` on success.
- `src/features/memory-cards/actions/unlink-card-from-note.ts` (new) — `unlinkCardFromNote(id: string)`: `update memory_cards set note_id = null where id = :id` (RLS-scoped, `.select('id').single()`). Re-fetch isn't needed; revalidate `/memory-cards` and (best-effort) the previously-linked note path if passed. Used by both card-side and note-side unlink UI.

#### 3. Route form

**File**: `src/features/memory-cards/card-form.tsx` (new, `'use client'`)

**Intent**: One form for standalone create + edit-any. Subject `Combobox` (optional) + card fields; in edit mode, show the source note + an Unlink action.

**Contract**: `useAppForm` with `{ subject_id, prompt, example, code_context }`. Subject picker reuses the `Combobox` + `NO_SUBJECT` sentinel from `note-form.tsx:110-125` (`null` when "none"). Prompt/example/code_context mirror `memory-card-form.tsx:80-114`. Props: `{ subjects: SubjectT[]; card?: MemoryCardT; sourceNote?: { id: string; title: string | null } }`. `card` present → edit (seed defaults, call `updateMemoryCard(card.id, …)`); absent → create (`createStandaloneCard`). When `sourceNote` present (edit of a linked card), render a "Source note: <title>" row with a link to `/notes/[id]` + an **Unlink** button calling `unlinkCardFromNote(card.id)` (router.refresh after). `data-testid` hooks (`card-form-*`, `card-unlink`) per the E2E lesson. On success the action redirects.

#### 4. Routes

**Files**:

- `src/app/(protected)/memory-cards/new/page.tsx` (new) — Server Component: fetch `getSubjects()`, render `CardForm` (no `card`) in `PageShell` (`width="wide"`, `backHref="/memory-cards"`) with the two-paths explainer above it (_attach a card to a note via that note's "Add card", or create a standalone card here, optionally filed under a topic_). Muted helper-text style.
- `src/app/(protected)/memory-cards/[id]/edit/page.tsx` (new) — Server Component: fetch the card (RLS-scoped; `notFound()` if missing), the user's subjects, and the source note title when `card.note_id` is set. Render `CardForm` with `card` + `sourceNote`. Bracket path needs `:(literal)` for git (lesson).

#### 5. Repoint edit + strip the in-note inline edit

**Files**:

- `src/features/memory-cards/utils/memory-card-edit-href.ts` — `memoryCardEditHref(id: string)` → `/memory-cards/${id}/edit` (drop `noteId`; update the comment — it no longer routes through the note).
- `src/features/memory-cards/memory-card-form.tsx` — strip to **create-only**: remove the `card` prop, `updateMemoryCard` import, edit-branch copy, and the `?edit`/Cancel affordances. It now serves only `AddMemoryCard`.
- `src/features/memory-cards/memory-cards-section.tsx` — remove the `editingCard`/`editId` branch (`:24-37`) and the stale-`?edit` redirect; always render `<AddMemoryCard>`. The per-card Edit `ButtonLink` now uses `memoryCardEditHref(card.id)`. (Per-card Unlink is added in Phase 4.)
- `src/app/(protected)/notes/[id]/page.tsx` — `searchParams` keeps only `?edit=note` (the note-body edit); drop the `editId`/`edit` forwarding to `MemoryCardsSection` (`:98`) and the related comment.
- Update the `MemoryCardsSection` callers' props accordingly.

### Success Criteria

#### Automated Verification

- New routes typegen + typecheck: `pnpm exec next typegen && pnpm typecheck`
- Lint passes: `pnpm lint`
- Build passes: `pnpm build`

#### Manual Verification

- `/memory-cards/new` renders explainer + subject picker + card fields; submit (with/without subject) creates a card and lands on `/memory-cards`; `/notes` shows no phantom note.
- `/memory-cards/[id]/edit` edits content **and** subject for a standalone card and for a linked card.
- Editing a linked card shows its source note + Unlink; clicking Unlink drops `note_id` (card survives, subject intact, no longer shows the note).
- In-note "Add card" still works; the note page no longer has an inline card-edit mode (Edit goes to `/memory-cards/[id]/edit`).

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 3.

---

## Phase 3: Entry points + null-note UI handling

### Overview

Surface "New card" where the user expects it, and make the card list/stats/delete safe for note-less cards (no broken `/notes/undefined` links). Edit affordance now shows for **every** card (route-based).

### Changes Required

- **Dashboard** (`dashboard/page.tsx:48`): wrap actions in a flex container — `New note` → `/notes/new`, `New card` → `/memory-cards/new`.
- **`/memory-cards` page** (`memory-cards/page.tsx`): add `ButtonLink href="/memory-cards/new"` to `PageShell` `actions`.
- **List** (`components/memory-cards-list.tsx`): `getHref` (`:21`) builds the source-note link only when `card.note_id` is set; the **Edit** affordance (`:24`) now renders for **all** cards via `memoryCardEditHref(card.id)`; `DeleteMemoryCardButton` (`:25`) works without a note (see below).
- **Hardest-cards** (`dashboard/hardest-cards.tsx` + `dashboard/stats.ts` + `dashboard/types.ts`): `HardestCardT.noteId` / `CardStatRowT.note_id` → `string | null`; render a plain (non-link) title when null. `stats.ts:69-70` already falls back to 'Untitled' — keep.
- **Delete action** (`actions/delete-memory-card.ts`): make the `noteId` param optional. Always `revalidatePath('/memory-cards')`; revalidate `/notes/{noteId}` only when present. Deletion by `id` (RLS-scoped) — unchanged. Update `DeleteMemoryCardButton` callers that pass `noteId`.

### Success Criteria

#### Automated Verification

- Typegen + typecheck / lint / build all pass.

#### Manual Verification

- Dashboard + `/memory-cards` show a working "New card" button.
- A standalone card row: Edit (→ route) + Delete, no broken note link, deletes successfully.
- A standalone "hardest" card renders without a broken `/notes/undefined` link.
- Linked cards unaffected (source-note link + edit + delete still work).

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 4.

---

## Phase 4: Note-side link management (confirmed bulk-move + per-card unlink)

### Overview

When a note's subject changes and it has linked cards, ask the user whether to move those cards too; on confirm, one bulk update moves them. Separately, the note's card section gets a per-card **Unlink** affordance (same `note_id → null` write as the card-side unlink).

### Changes Required

#### 1. Bulk-move on note-subject change

**Files**: `src/features/notes/actions/update-note.ts` + `src/features/notes/note-form.tsx`

**Intent**: User-confirmed cascade of a note's subject to its linked cards. No trigger.

**Contract**:

- `note-form.tsx` (edit mode only): accept a `linkedCardCount: number` prop. On submit, if the subject changed (`value.subject_id !== note.subject_id`) **and** `linkedCardCount > 0`, show a confirm dialog — _"Move this note's N cards to the new subject too?"_ [Move cards] / [Keep as-is] — and pass the choice as `moveLinkedCards: boolean` into `updateNote`. (Plain title/content edits never prompt.)
- `update-note.ts`: extend the existing subject-change branch (`:30-40`). When `data.subject_id` changed and `moveLinkedCards` is true, run one `update memory_cards set subject_id = :new where note_id = :id` (RLS-scoped) inside the same action. **Overwrites all linked cards' subjects** (the confirm dialog is the safety; no dirty-flag tracking). Revalidate `/memory-cards` in addition to the note paths.
- Note detail page (`notes/[id]/page.tsx`): pass `linkedCardCount={memoryCards.length}` into `NoteForm` in edit mode.

#### 2. Per-card Unlink in the note's card section

**File**: `src/features/memory-cards/memory-cards-section.tsx`

**Intent**: Drop a card's source-note link from the note side.

**Contract**: Add an **Unlink** button next to each card's Edit/Delete, calling `unlinkCardFromNote(card.id)` (the Phase-2 action), then `router.refresh()` / revalidation removes it from this note's section. (A small client wrapper button, mirroring `DeleteMemoryCardButton`.)

### Success Criteria

#### Automated Verification

- Typegen + typecheck / lint / build all pass.

#### Manual Verification

- Edit a note's subject with linked cards → prompt appears; **Move** relocates all its cards (verify via `/memory-cards` subject filter); **Keep** leaves them.
- Plain title/content edit of a note with cards → no prompt.
- Unlink a card from the note's card section → it disappears from the note but still exists in `/memory-cards` with its subject.

**Implementation Note**: After automated verification passes, pause for the review gate.

---

## Testing Strategy

> Per the project review gate, the test layer is authored AFTER review + `/simplify`, locking in the cleaned-up code.

### Unit Tests

- `cardWithSubjectSchema`: rejects empty prompt; accepts null subject; `z.guid()` accepts a non-v4 (seed-shaped) id, rejects non-uuid shape (per the `z.guid` lesson).

### Integration / DB

- Insert a standalone card with a subject → row has `note_id = null`, `subject_id` set; RLS rejects a subject owned by another user (insert + update).
- `createMemoryCard` from a note → card's `subject_id` = the note's subject (app seed).
- `updateNote` with `moveLinkedCards` → all linked cards' `subject_id` follows; without it → unchanged.
- `unlinkCardFromNote` → `note_id` null, `subject_id` untouched; RLS rejects a non-owned card.

### E2E (Playwright, `data-testid` selectors)

- Dashboard "New card" → fill prompt + pick subject → submit → on `/memory-cards` under that subject; `/notes` count unchanged.
- Standalone card with no subject → appears unfiled.
- Edit a standalone card's subject via `/memory-cards/[id]/edit` → reflected in the list.
- Add a card from a note → edit it → Unlink → it leaves the note, survives standalone.
- Edit a note's subject with linked cards → confirm dialog → Move → cards relocate.
- Local-stack E2E sign-up flake handled by `retries: 2` (lessons) — self-seed per test.

### Manual Testing Steps

1. `supabase db reset`; sign in as `test@gmail.com`.
2. New card (no subject) → confirm on `/memory-cards`. New card (with subject) → confirm filtered.
3. Edit a standalone card (content + subject) → confirm saved.
4. Add a card from a seeded note → edit → Unlink → confirm it survives standalone.
5. Edit a seeded note's subject → Move → confirm its cards relocate; repeat with Keep.
6. Review on the dashboard until a standalone card appears → no source-note link; rate it. Delete a standalone card.

## Performance Considerations

Negligible. The `subject_id` index supports the list filter; the bulk move is a single indexed `update … where note_id = :id` fired only on a confirmed subject change.

## Migration Notes

- No data backfill (disposable local data; seed regenerates). Update `seed.sql` so linked seed cards carry `subject_id`.
- Regenerate and commit the Supabase `Database` types after the migration.
- Route additions require `pnpm exec next typegen` before `pnpm typecheck` (lessons); bracket route path needs `:(literal)` for git.

## References

- Internal research: `context/changes/standalone-memory-cards/research.md`
- RLS subject-ownership pattern to mirror: `supabase/migrations/20260603151508_add_subjects_and_note_ordering.sql:59-86`
- Subject `Combobox` reuse: `src/features/notes/note-form.tsx:110-125`
- Route + action + `toastRedirect` pattern: `src/app/(protected)/notes/new/page.tsx`, `src/features/notes/actions/create-note.ts`, `update-note.ts`
- Note subject-change hook point: `src/features/notes/actions/update-note.ts:30-40`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Decouple the data model

#### Automated

- [x] 1.1 Migration + reseed applies cleanly: `supabase db reset` — 7cbac47
- [x] 1.2 Supabase types regenerated and committed — 7cbac47
- [x] 1.3 Type check passes: `pnpm exec next typegen && pnpm typecheck` — 7cbac47
- [x] 1.4 Lint passes: `pnpm lint` — 7cbac47
- [x] 1.5 Build passes: `pnpm build` — 7cbac47

#### Manual

- [x] 1.6 `/memory-cards` list renders seeded cards with subject + note title — 7cbac47
- [x] 1.7 In-note add seeds the card's subject from the note — 7cbac47
- [x] 1.8 Subject filter keys off `memory_cards.subject_id` — 7cbac47

### Phase 2: Unified create + edit surface

#### Automated

- [x] 2.1 New routes typegen + typecheck: `pnpm exec next typegen && pnpm typecheck` — 25a25e8
- [x] 2.2 Lint passes: `pnpm lint` — 25a25e8
- [x] 2.3 Build passes: `pnpm build` — 25a25e8

#### Manual

- [x] 2.4 `/memory-cards/new` creates a card (with/without subject), lands on `/memory-cards`, no phantom note — 25a25e8
- [x] 2.5 `/memory-cards/[id]/edit` edits content + subject for standalone AND linked cards — 25a25e8
- [x] 2.6 Editing a linked card shows source note + Unlink; Unlink drops `note_id`, card survives — 25a25e8
- [x] 2.7 In-note add still works; note page has no inline card-edit mode — 25a25e8

### Phase 3: Entry points + null-note UI handling

#### Automated

- [x] 3.1 Typegen + typecheck: `pnpm exec next typegen && pnpm typecheck`
- [x] 3.2 Lint passes: `pnpm lint`
- [x] 3.3 Build passes: `pnpm build`

#### Manual

- [ ] 3.4 Dashboard + `/memory-cards` show a working "New card" button
- [ ] 3.5 Standalone card row: Edit (route) + Delete, no broken note link, deletes
- [ ] 3.6 Standalone "hardest" card renders without `/notes/undefined`
- [ ] 3.7 Linked cards unaffected (note link + edit + delete)

### Phase 4: Note-side link management

#### Automated

- [ ] 4.1 Typegen + typecheck: `pnpm exec next typegen && pnpm typecheck`
- [ ] 4.2 Lint passes: `pnpm lint`
- [ ] 4.3 Build passes: `pnpm build`

#### Manual

- [ ] 4.4 Note subject change with linked cards → prompt; Move relocates all; Keep leaves them
- [ ] 4.5 Plain title/content edit → no prompt
- [ ] 4.6 Per-card Unlink in the note section drops `note_id`; card survives in `/memory-cards`
