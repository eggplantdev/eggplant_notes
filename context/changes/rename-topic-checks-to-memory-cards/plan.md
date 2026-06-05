# Rename "topic checks" → "memory cards" Implementation Plan

## Overview

Cross-cutting rename of the recall-unit term from `topic_checks` to `memory_cards` across the entire stack: DB schema (table, indexes, RLS policies, RPCs, the `review_events` FK column), generated types, feature directory, route URL, all code identifiers, UI copy, tests, and live foundation docs. The data is disposable — migrations are rewritten in place and `supabase db reset` rebuilds the local DB.

## Current State Analysis

The term is woven through ~70 files (`rg -il 'topic[_-]?check'`). The load-bearing pieces:

- **DB** — 4 migrations define and evolve the table:
  - `20260603070945_init_notes_topic_checks_review_events.sql` — `create table topic_checks`, 3 indexes (`topic_checks_user_id_idx`, `topic_checks_note_id_idx`, `topic_checks_user_id_due_at_idx`), 4 RLS policies (`topic_checks_{select,insert,update,delete}_own`), and `review_events.topic_check_id` FK (+ `review_events_topic_check_id_idx`).
  - `20260603104838_add_topic_check_content_columns.sql` — `alter table topic_checks add column example / code_context`.
  - `20260603131542_fsrs_review_loop.sql` — `alter table topic_checks` (FSRS columns) + `record_review(p_topic_check_id, ...)` RPC that writes `public.topic_checks` and inserts `review_events (topic_check_id, ...)`, plus `raise exception 'topic check not found or not owned'`.
  - `20260603180614_create_note_with_checks_rpc.sql` — `create_note_with_checks` RPC inserts into `public.topic_checks`.
- **Generated types** — `src/lib/supabase/types.ts` is produced by `pnpm db:types` (`supabase gen types typescript --local`). Never hand-edited; regenerated after `db reset`.
- **Feature dir** — `src/features/topic-checks/` (actions/, components/, utils/, ~15 files) + `src/features/review/actions/rate-topic-check.ts`.
- **Route** — `src/app/(protected)/topic-checks/page.tsx` (URL `/topic-checks`); nav entry in `src/components/app-nav/nav-items.ts` (`href: '/topic-checks'`, label `'Topic checks'`).
- **Seed** — `supabase/seed.sql` + `supabase/seed-scripts/generate-section-seed.mjs`.
- **Tests** — `e2e/topic-checks.spec.ts`, `e2e/topic-checks-listing.spec.ts`, plus refs in `e2e/{review,notes,isolation,create-note-with-checks}.spec.ts`, `e2e/helpers.ts`; unit `src/__tests__/{review-scheduling,format-review-status,daily-goal}.test.ts`.
- **Docs** — live `context/foundation/` (prd-v2, roadmap, lessons, shape-notes).

### Key Discoveries:

- `types.ts` is generated, not authored → DB must change first, then regenerate (`package.json:19` `db:types`).
- `review_events.topic_check_id` is a FK column in a _different_ table; renaming the table without renaming this column reproduces the UI/schema drift the rename exists to kill — so it is in scope (`...init...sql:89`, `...fsrs_review_loop.sql:77`).
- `record_review` RPC param `p_topic_check_id` is passed from `src/features/review/actions/rate-topic-check.ts` → both the SQL signature and the TS caller must change together.
- Migration strategy is **rewrite-in-place** (data disposable, `db reset` will run) — NOT a forward `ALTER ... RENAME`. Decided in `change.md`.

## Desired End State

No occurrence of `topic[_-]?check` / `topicCheck` / `TopicCheck` anywhere in `src/`, `supabase/`, `e2e/`, `src/__tests__/`, route paths, or live `context/foundation/` docs (verified by `rg`). `supabase db reset` applies clean, `pnpm db:types` regenerates a `memory_cards`-keyed `types.ts`, and the full suite (`typecheck`, `lint`, `test`, `build`, `test:e2e`) is green. The app exposes `/memory-cards` with a "Memory cards" nav label.

## What We're NOT Doing

- **No data preservation / no forward `ALTER RENAME` migration.** Rewrite history; `db reset` rebuilds.
- **Not touching `context/archive/`** (immutable) or `context/foundation/archive/2026-06-03-roadmap.md` (historical record).
- **Not renaming `review_events`** (the table) or `notes` — only the `topic_check_id` FK column within `review_events`.
- **Not renaming the `review` feature** or the `review`/`review-events` vocabulary — "review" is the session verb and stays.
- **No redirect** from old `/topic-checks` URL — solo MVP, no external links to preserve.
- **Not running the review gate here** — `/simplify` + the 4-check fan-out + archive run after this plan completes (CLAUDE.md per-slice gate), as a separate step.

## Implementation Approach

Strictly ordered by the generated-types dependency: **DB → regenerate types → code/structure → docs → verify**. Each casing variant maps deterministically:

| From                                                       | To                             |
| ---------------------------------------------------------- | ------------------------------ |
| `topic_checks` (table/snake)                               | `memory_cards`                 |
| `topic_check_id`                                           | `memory_card_id`               |
| `p_topic_check_id`                                         | `p_memory_card_id`             |
| `topic-checks` / `topic-check` (dirs, files, route, kebab) | `memory-cards` / `memory-card` |
| `TopicCheck` / `TopicChecks` (types, PascalCase)           | `MemoryCard` / `MemoryCards`   |
| `topicCheck` / `topicChecks` (camelCase identifiers)       | `memoryCard` / `memoryCards`   |
| `Topic checks` / `topic check` (UI copy, prose)            | `Memory cards` / `memory card` |

## Critical Implementation Details

- **Ordering is load-bearing.** `types.ts` is generated from the live DB. Editing code before `db reset` + `pnpm db:types` means typecheck runs against stale `topic_checks` types. Phase 1 must fully complete (reset + regenerate) before Phase 2.
- **RPC signature + caller move together.** `record_review`'s param rename (`p_topic_check_id` → `p_memory_card_id`) is a contract shared between `fsrs_review_loop.sql` and `rate-topic-check.ts` — both in the same logical change; a half-rename compiles but breaks the call.
- **`git mv` for traceability.** Use `git mv` for the feature-dir, route-dir, and file renames so history follows; a plain `mv` + add loses blame continuity.

## Phase 1: DB layer + regenerated types

### Overview

Rewrite the 4 migrations in place, rename the init migration file, update the seed assets, reset the local DB, and regenerate `types.ts`.

### Changes Required:

#### 1. Init migration

**File**: `supabase/migrations/20260603070945_init_notes_topic_checks_review_events.sql` → rename file to `20260603070945_init_notes_memory_cards_review_events.sql`

**Intent**: Define the table as `memory_cards`; rename its 3 indexes and 4 RLS policies; rename the `review_events.topic_check_id` column + its index + FK reference. Update the cascade-chain comment.

**Contract**: `create table memory_cards`; indexes `memory_cards_user_id_idx` / `memory_cards_note_id_idx` / `memory_cards_user_id_due_at_idx`; policies `memory_cards_{select,insert,update,delete}_own`; `review_events.memory_card_id uuid not null references memory_cards (id)`; index `review_events_memory_card_id_idx`.

#### 2. Content-columns migration

**File**: `supabase/migrations/20260603104838_add_topic_check_content_columns.sql`

**Intent**: Retarget the `alter table` to `memory_cards`. Update header comment. (Filename keeps `topic_check` — see Note below; or rename for cleanliness — decision: keep filenames stable except the init one to minimize churn, EXCEPT this is optional. Default: leave non-init migration filenames as-is; they are opaque timestamps. Update only their SQL bodies + comments.)

**Contract**: `alter table memory_cards add column example text; alter table memory_cards add column code_context text;`

#### 3. FSRS migration

**File**: `supabase/migrations/20260603131542_fsrs_review_loop.sql`

**Intent**: Retarget all `alter table topic_checks` to `memory_cards`; rename the `record_review` param `p_topic_check_id` → `p_memory_card_id` (signature, body `where id =`, `revoke`/`grant`); update the `review_events` insert column to `memory_card_id`; update the `raise exception` message to "memory card not found or not owned"; update comments.

**Contract**: `record_review(p_memory_card_id uuid, p_rating smallint, p_card jsonb)`; `update public.memory_cards set ... where id = p_memory_card_id`; `insert into public.review_events (memory_card_id, rating)`.

#### 4. create_note_with_checks migration

**File**: `supabase/migrations/20260603180614_create_note_with_checks_rpc.sql`

**Intent**: Retarget the staged-checks insert to `memory_cards`. Update comments referencing `topic_checks_insert_own`. (RPC name `create_note_with_checks` and param names stay — "checks" here is generic phrasing; renaming the RPC is out of scope to avoid touching the S-07 contract. The body's table reference is what must change.)

**Contract**: `insert into public.memory_cards (note_id, prompt, example, code_context) ...`; comment ref `memory_cards_insert_own`.

#### 5. Seed assets

**File**: `supabase/seed.sql`, `supabase/seed-scripts/generate-section-seed.mjs`

**Intent**: Replace all `topic_checks` / `topic_check_id` references with the new names so `db reset` seeds both dev accounts against the renamed schema. Preserve the idempotency notes (the `test@gmail.com` id-keyed block; the un-guarded `dev@example.com` block).

**Contract**: `insert into memory_cards ...`; `review_events (memory_card_id, ...)`.

#### 6. Reset + regenerate

**Intent**: Apply the rewritten schema locally and regenerate the typed client.

**Contract**: `supabase db reset` then `pnpm db:types` → `src/lib/supabase/types.ts` now keys `memory_cards` and `review_events.memory_card_id`.

### Success Criteria:

#### Automated Verification:

- `supabase db reset` applies all migrations cleanly with no error.
- `pnpm db:types` regenerates `types.ts`; `rg 'topic_check' src/lib/supabase/types.ts` returns nothing.
- No `topic[_-]?check` remains in `supabase/` except archived/irrelevant: `rg -i 'topic[_-]?check' supabase/` returns nothing.

#### Manual Verification:

- Both seed accounts (`dev@example.com`, `test@gmail.com`) load with their memory cards after reset.

---

## Phase 2: Code + structure rename

### Overview

Move the feature dir and route dir, rename files, and sweep every identifier, import, and UI string across `src/`, `e2e/`, and `src/__tests__/`.

### Changes Required:

#### 1. Feature directory move

**File**: `src/features/topic-checks/` → `src/features/memory-cards/`

**Intent**: `git mv` the directory, then `git mv` each `topic-check*`-named file inside to `memory-card*` (`add-topic-check.tsx`, `topic-check-form.tsx`, `topic-checks-section.tsx`, `topic-checks-list.tsx`, `topic-check-card-actions.tsx`, `delete-topic-check-button.tsx`, `actions/{create,update,delete}-topic-check.ts`, `utils/topic-check-edit-href.ts`).

**Contract**: New paths under `src/features/memory-cards/`; file basenames use `memory-card`.

#### 2. Review action rename

**File**: `src/features/review/actions/rate-topic-check.ts` → `rate-memory-card.ts`

**Intent**: `git mv` + update its `record_review` RPC call to pass `p_memory_card_id` and rename internal identifiers.

**Contract**: Calls `record_review({ p_memory_card_id, p_rating, p_card })` matching the renamed RPC signature.

#### 3. Route move + nav

**File**: `src/app/(protected)/topic-checks/page.tsx` → `src/app/(protected)/memory-cards/page.tsx`; `src/components/app-nav/nav-items.ts`

**Intent**: `git mv` the route dir (URL becomes `/memory-cards`); update nav entry `href: '/memory-cards'`, label `'Memory cards'`.

**Contract**: `nav-items.ts` → `{ href: '/memory-cards', label: 'Memory cards' }`.

#### 4. Identifier + import + copy sweep

**File**: all files from `rg -il 'topic[_-]?check' src/` (schemas, queries, types, action files, dashboard, notes, markdown, review-events, hooks, lib/utils/date.ts, etc.)

**Intent**: Apply the casing map (table above) to every type (`MemoryCard*`), identifier (`memoryCard*`), import path (`@/features/memory-cards/...`), and user-facing string ("Memory cards"/"memory card"). Includes `src/features/review-events/{queries,today-count}.ts` updating `memory_card_id` column references and `src/app/(protected)/notes/[id]/page.tsx`, `dashboard/page.tsx`, etc.

**Contract**: Post-sweep, `rg -i 'topic[_-]?check' src/` returns nothing.

#### 5. Tests

**File**: `e2e/topic-checks.spec.ts` → `e2e/memory-cards.spec.ts`; `e2e/topic-checks-listing.spec.ts` → `e2e/memory-cards-listing.spec.ts`; refs in `e2e/{review,notes,isolation,create-note-with-checks}.spec.ts`, `e2e/helpers.ts`; unit `src/__tests__/{review-scheduling,format-review-status,daily-goal}.test.ts`

**Intent**: `git mv` the two spec files; update all selectors, URLs (`/memory-cards`), copy assertions, and identifiers across e2e + unit specs.

**Contract**: Specs target `/memory-cards`, assert "Memory cards" copy; `rg -i 'topic[_-]?check' e2e/ src/__tests__/` returns nothing.

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck` passes (proves imports/identifiers/types all resolve post-move).
- `pnpm lint` passes.
- `rg -il 'topic[_-]?check' src/ e2e/ src/__tests__/` returns nothing.

#### Manual Verification:

- App boots; `/memory-cards` renders the list; nav shows "Memory cards".
- Create-note-with-cards, rate-a-card, and the dashboard review flow work end-to-end in the browser.

---

## Phase 3: Docs + verify green

### Overview

Update live foundation docs and run the full verification suite.

### Changes Required:

#### 1. Foundation docs

**File**: `context/foundation/prd-v2.md`, `roadmap.md`, `lessons.md`, `shape-notes.md` (and `prd.md` if it still references the term)

**Intent**: Replace user-facing/domain references to "topic checks" with "memory cards", preserving historical accuracy where a sentence describes a past slice by its then-name (judgment: update the living vocabulary, keep archived slice IDs/titles intact). Do NOT touch `context/foundation/archive/`.

**Contract**: Live foundation docs use "memory cards"; `context/foundation/archive/` untouched.

#### 2. Full suite

**Intent**: Confirm green across the whole pipeline with the local Supabase stack up.

**Contract**: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e`.

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck` passes.
- `pnpm lint` passes.
- `pnpm test` passes (unit specs).
- `pnpm build` succeeds.
- `pnpm test:e2e` passes (local Supabase stack up).
- `rg -il 'topic[_-]?check' --glob '!context/archive/**' --glob '!context/foundation/archive/**'` returns only intended residue (none in code/docs).

#### Manual Verification:

- Spot-check the dashboard, notes detail, and `/memory-cards` listing in the browser — copy reads "memory card(s)" consistently, no stale "topic check" anywhere visible.

---

## Testing Strategy

### Unit Tests:

- Update `review-scheduling`, `format-review-status`, `daily-goal` specs to the renamed identifiers; assertions on copy/status strings updated to "memory card".

### Integration / E2E Tests:

- Renamed `memory-cards.spec.ts` + `memory-cards-listing.spec.ts` drive `/memory-cards`; `review`, `notes`, `isolation`, `create-note-with-checks` specs updated for new URLs/copy/selectors.

### Manual Testing Steps:

1. `supabase db reset`, sign in as `dev@example.com`, confirm memory cards seeded.
2. Visit `/memory-cards`, create a note with cards, rate a card, confirm dashboard review flow.
3. `rg -i 'topic[_-]?check'` across the repo (excluding archives) returns nothing.

## Migration Notes

Rewrite-in-place, no data migration. The local DB is rebuilt via `supabase db reset`; both seed accounts regenerate. Production (if it ran the old migrations) is intentionally disregarded — a `db reset`-equivalent is acceptable before launch per the change owner.

## References

- Change identity: `context/changes/rename-topic-checks-to-memory-cards/change.md`
- DB source: `supabase/migrations/20260603070945_init...`, `..._fsrs_review_loop.sql`, `..._create_note_with_checks_rpc.sql`
- Types gen: `package.json:19` (`db:types`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: DB layer + regenerated types

#### Automated

- [x] 1.1 `supabase db reset` applies all migrations cleanly
- [x] 1.2 `pnpm db:types` regenerates types.ts; no `topic_check` in types.ts
- [x] 1.3 No `topic[_-]?check` remains in `supabase/` (one intentional exception: the `S-02 attach-topic-checks` historical slice-id comment in `..._add_topic_check_content_columns.sql`)

#### Manual

- [ ] 1.4 Both seed accounts load with memory cards after reset

### Phase 2: Code + structure rename

#### Automated

- [ ] 2.1 `pnpm typecheck` passes
- [ ] 2.2 `pnpm lint` passes
- [ ] 2.3 No `topic[_-]?check` in `src/ e2e/ src/__tests__/`

#### Manual

- [ ] 2.4 App boots; `/memory-cards` renders; nav shows "Memory cards"
- [ ] 2.5 Create-with-cards, rate-a-card, dashboard review flow work in browser

### Phase 3: Docs + verify green

#### Automated

- [ ] 3.1 `pnpm typecheck` passes
- [ ] 3.2 `pnpm lint` passes
- [ ] 3.3 `pnpm test` passes
- [ ] 3.4 `pnpm build` succeeds
- [ ] 3.5 `pnpm test:e2e` passes
- [ ] 3.6 No `topic[_-]?check` outside archives

#### Manual

- [ ] 3.7 Browser spot-check: copy reads "memory card(s)" consistently
