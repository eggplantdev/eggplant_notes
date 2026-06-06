# Load / Clear Sample Data (S-12) Implementation Plan

## Overview

Add a one-click **Load sample data** affordance for an empty account and a paired **Clear
sample data**, so a tutor/evaluator sees the whole product working (subjects, notes-with-code,
memory cards, the recall loop) without hand-entering data. The sample content's source of truth
stays `supabase/seed.sql` (the `test@gmail.com` corpus), but `seed.sql` is never modified;
content reaches production as a **generated, committed fixture** that the loader inserts under
the current user via the RLS client.

Approved design: `docs/superpowers/specs/2026-06-06-seed-sample-data-design.md`.

## Current State Analysis

- **No sample-data feature exists.** Empty accounts show only the "Create a note" empty state
  (`src/app/(protected)/notes/page.tsx`) and `/settings` has Preferences + Danger zone only.
- **The only sample content is dev-only.** `supabase/seed.sql` seeds two fixed `auth.users`
  (`dev@example.com`, `test@gmail.com` = `eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee`) on local
  `db reset`. It **never runs on Vercel**, so prod has no copy of the content and no template
  account to copy from.
- **Schema** (relevant): `subjects(id, user_id default auth.uid(), title, description, …)`;
  `notes(id, user_id, title, content, subject_id → subjects on delete set null, position numeric, …)`;
  `memory_cards(id, user_id, note_id → notes on delete cascade, prompt, example, code_context,
state smallint default 0, due_at timestamptz default now(), …)`. RLS scopes every table by
  `auth.uid()`.
- **Patterns to follow:** Server Actions return `ActionResultT` (`src/types/action.ts`); RLS
  client via `createClient()` + `getCurrentUser()` (`src/lib/supabase/server.ts`); the
  account-delete action calls a SECURITY DEFINER RPC; `update-daily-goal` upserts +
  `revalidatePath`. Feedback uses the S-16 toast plumbing. `EmptyState`
  (`src/components/ui/empty-state.tsx`) takes a single optional `action`.

### Key Discoveries:

- `memory_cards.note_id … on delete cascade` (init migration) → deleting a seeded note deletes
  its cards; Clear only deletes seeded notes + seeded subjects.
- `updated_at` is DB-trigger-owned (`moddatetime`, migration `20260606083954`) — the loader
  must NOT set `created_at`/`updated_at` (lesson: never hand-stamp).
- Cards inserted with schema defaults get `state=0` (New), `due_at=now()` → **all due
  immediately**, so `/review` works on load (demo depth = cards + due-now only).
- E2E local sign-up is flaky behind `retries: 2`; don't hard-gate on it (lesson).
- The loader takes **no DB-originated id input** (button-triggered, fixture refs are internal),
  so the `z.uuid()` vs `z.guid()` trap does not apply here.

## Desired End State

A signed-in user on an empty account sees **Load sample data** in `/settings` and in the
`/notes` empty state. Clicking it populates their account (subjects + notes-with-code + cards,
all due now) under their own `user_id`, every row flagged `is_seeded = true`. `/notes`,
`/subjects`, `/review`, and the dashboard due-count come alive. A **Clear sample data** control
(shown only when seeded rows exist) removes exactly the seeded rows, returning the account to
empty. Works identically on local and on the Vercel prod deployment.

## What We're NOT Doing

- NOT modifying `supabase/seed.sql` or `generate-section-seed.mjs`.
- NOT synthesizing `review_events` / FSRS state / review history (heatmap, streak, daily-goal
  bar stay empty until the user actually reviews) — demo depth is "cards + due-now only".
- NOT seeding the template account into prod, and NOT using a service-role client.
- NOT adding `pg_trgm` or any index.
- NOT changing the shared `EmptyState` component (render the Load button alongside it instead).
- NOT re-banding S-12 in the roadmap beyond marking it done at archive.

## Implementation Approach

A new feature module `src/features/sample-data/` owns everything. The fixture is generated once
(and re-generated whenever seed content changes) by a standalone dump script that reads the
local DB; it is committed as a typed TS module that ships in the prod bundle. The loader is a
plain Server Action doing three ordered inserts (subjects → notes → cards) with parent→child id
remap via a pure, unit-tested helper; on any error it rolls back by invoking the clear path.
Clear is a Server Action deleting seeded notes (cascading cards) then seeded subjects. Gating
queries decide which control to show. UI mounts in `/settings` and the `/notes` empty state with
S-16 toasts + `useTransition`.

## Critical Implementation Details

- **Insert ordering + remap is load-bearing.** Subjects insert first and return real ids; notes
  map their fixture `subjectRef` → the new subject id (and keep `position`); cards map their
  `noteRef` → the new note id. `user_id` comes from the authed client on every row, never from
  the fixture. The remap is a pure function so it can be unit-tested without the DB.
- **Partial-failure rollback.** supabase-js multi-insert is not one transaction. If notes or
  cards insert fails after subjects landed, the action calls the clear path (delete where
  `is_seeded`) before returning the error, so a failed load never leaves a half-seeded account.
  The shared clear path deletes ALL `is_seeded = true` rows; this is destruction-safe **only
  because** `loadSampleData` guards on `isAccountEmpty()`, so no pre-existing seeded rows can be
  collateral. If that guard is ever loosened, the rollback's blanket delete must be revisited.
- **Half-seeded state self-heals via gating.** If a load fails AND its rollback also fails (both
  best-effort), the account is left with seeded rows → `hasSeededData()` is true → the UI shows
  **Clear**, so the user can clear and retry. This is intentional: the gating absorbs the
  partial state without a dead-end.

## Phase 1: Marker migration

### Overview

Add the `is_seeded` flag to the three content tables so Clear can scope its deletes and gating
can detect seeded rows.

### Changes Required:

#### 1. New migration

**File**: `supabase/migrations/<timestamp>_add_is_seeded_marker.sql`

**Intent**: Add a boolean `is_seeded` marker to `subjects`, `notes`, and `memory_cards` so
seeded rows are distinguishable from user-authored ones (all three per the decision, for a
uniform marker). Additive only; RLS policies unchanged (existing per-user policies already gate
the whole row).

**Contract**: `alter table <t> add column is_seeded boolean not null default false;` on each of
`subjects`, `notes`, `memory_cards`. No index (gating reads are per-user, tiny). Use the next
`date +%Y%m%d%H%M%S` timestamp prefix.

#### 2. Regenerate types

**File**: `src/lib/supabase/types.ts` (the generated `Database` type)

**Intent**: Reflect the new column in the typed client so inserts can set `is_seeded`.

**Contract**: Run `pnpm db:types` (wraps `supabase gen types typescript --local > src/lib/supabase/types.ts`) after `db reset`; the three tables' Row/Insert types gain `is_seeded: boolean`.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `supabase db reset`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- `\d memory_cards` (and notes, subjects) shows `is_seeded boolean not null default false`.

---

## Phase 2: Fixture generator + committed fixture

### Overview

Produce the generated, committed sample-data fixture from the local seed corpus, with a
standalone dump script that never touches `seed.sql`.

### Changes Required:

#### 1. Dump script

**File**: `supabase/seed-scripts/dump-sample-fixture.mjs`

**Intent**: Read the template account's content from the local DB and emit the typed fixture.
Independent of `generate-section-seed.mjs` (which only parses markdown).

**Contract**: Connects to local Postgres via the existing `@supabase/supabase-js` (local URL +
service-role key from the local stack — dev-only, no new dependency). Selects `subjects`,
`notes`, `memory_cards` owned by `user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'`. Writes
`src/features/sample-data/sample-data.ts` exporting a typed `SAMPLE_DATA` const with:
`subjects: { ref, title, description }[]`, `notes: { ref, subjectRef|null, title, content,
position }[]`, `cards: { noteRef, prompt, example|null, codeContext|null }[]`. `ref` values are
synthetic stable keys (e.g. original seed id as string) used only for in-fixture parent linkage;
real DB ids/`user_id`/timestamps/FSRS columns are excluded. Emit a header comment documenting
the regenerate workflow (edit seed → `db reset` → run this → commit). Add a `package.json`
script alias (e.g. `seed:dump-fixture`).

#### 2. Generated fixture

**File**: `src/features/sample-data/sample-data.ts` (committed output)

**Intent**: The prod-shippable content. Hand-edits are not allowed — it is regenerated.

**Contract**: `export const SAMPLE_DATA: SampleDataT = { … }`. Define `SampleDataT` here (or in a
sibling `types.ts`) so the loader and the dump agree on shape.

### Success Criteria:

#### Automated Verification:

- Dump runs without error against a freshly reset local DB: `pnpm seed:dump-fixture`
- Generated file imports + type-checks: `pnpm typecheck`
- Linting passes (file is Prettier-clean): `pnpm lint`

#### Manual Verification:

- `sample-data.ts` contains the expected subject(s), a representative set of notes with code
  fences, and cards with `prompt`/`example`/`code_context` — counts roughly matching the
  `test@gmail.com` corpus.

---

## Phase 3: Gating queries + Server Actions

### Overview

The data layer: detect empty/seeded state, and load/clear under RLS with remap + rollback.

### Changes Required:

#### 1. Pure remap helper

**File**: `src/features/sample-data/remap.ts`

**Intent**: Turn `SAMPLE_DATA` + freshly assigned ids into insert-ready row arrays, mapping
`subjectRef`/`noteRef` to the new parent ids. Pure (no DB) so it's unit-testable.

**Contract**: Given the fixture and a function/map producing new ids per ref, return
`{ subjects, notes, cards }` row arrays with remapped foreign keys, preserved `position`, and
`is_seeded: true`. `user_id` is injected by the caller (the action), not here.

#### 2. Gating queries

**File**: `src/features/sample-data/queries.ts`

**Intent**: Two cheap reads for the UI: is the account empty, and does it have seeded rows.

**Contract**: `isAccountEmpty()` → `true` when the user has zero `notes` and zero `subjects`
(`count: 'exact', head: true`). `hasSeededData()` → `true` when any `notes` or `subjects` row
has `is_seeded = true`. RLS scopes both to the caller.

#### 3. `loadSampleData` action

**File**: `src/features/sample-data/actions/load-sample-data.ts`

**Intent**: Insert the fixture under the current user. Guard, remap, insert in order, roll back
on failure.

**Contract**: `'use server'`; returns `ActionResultT`. Refuse (`success: false`) if
`!isAccountEmpty()`. Generate new ids per ref (client-side `crypto.randomUUID()` or let the DB
default and read back — prefer pre-generating so remap is straightforward), call `remap`, then
insert subjects → notes → cards via `createClient()` with `user_id` from `getCurrentUser()`,
each row `is_seeded: true`. Do NOT set `created_at`/`updated_at` (DB trigger owns them) or card
scheduling columns (defaults give `state=0`, `due_at=now()`). On any insert error, call the
clear path then return the error. On success `revalidatePath` `/notes`, `/subjects`,
`/dashboard`, `/settings`, `/review`.

#### 4. `clearSampleData` action

**File**: `src/features/sample-data/actions/clear-sample-data.ts`

**Intent**: Remove only seeded rows.

**Contract**: `'use server'`; returns `ActionResultT`. `delete().eq('is_seeded', true)` on
`notes` (cascades their `memory_cards`) then on `subjects`. Same `revalidatePath` set. Reused by
the loader's rollback path (extract the deletion into a shared internal so both call it).

#### 5. Unit test for remap

**File**: `src/__tests__/sample-data-remap.test.ts`

**Intent**: Lock the remap contract without a DB.

**Contract**: Given a small fixture, assert every note's `subject_id` and every card's `note_id`
resolve to the right new ids, `position` is preserved, and `is_seeded` is set on all rows.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `pnpm test`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- From a freshly reset DB, signing in as a brand-new account and calling load (via the UI in
  Phase 4) populates rows owned by that user with `is_seeded = true`; calling clear removes
  exactly those rows; a second load after clear succeeds (guard passes again).

---

## Phase 4: UI wiring

### Overview

Surface Load/Clear in `/settings` and a Load CTA in the `/notes` empty state, with toasts.

### Changes Required:

#### 1. Settings "Sample data" section

**File**: `src/features/sample-data/components/sample-data-section.tsx`

**Intent**: A settings card that shows **Load** when the account is empty and **Clear** when
seeded rows exist. Buttons fire the actions via `useActionTransition()` for pending state +
toast on result.

**Contract**: Client component receiving `isEmpty` / `hasSeeded` booleans (or a small server
wrapper that reads the gating queries and passes them down). Mirrors the
`DeleteSubjectDialog`/`DailyGoalForm` interaction shape: use the existing
`useActionTransition()` hook (`@/hooks/use-action-transition`) — `const { isPending, run } =
useActionTransition()`, then `run(() => clearSampleData(), { successMessage: '…' })`. The hook
already runs the action in a transition and drives the success/error toast via `toastResult`;
do NOT hand-roll `useTransition` + a separate toast call. (Load/Clear do not redirect, so this
is the in-place path, not `toastRedirect`.)

#### 2. Mount in settings page

**File**: `src/app/(protected)/settings/page.tsx`

**Intent**: Add a "Sample data" `<section>` between Preferences and Danger zone, fed by the
gating queries.

**Contract**: `await` `isAccountEmpty()` + `hasSeededData()`; render `<SampleDataSection …/>`.

#### 3. Load CTA in the notes empty state

**File**: `src/app/(protected)/notes/page.tsx`

**Intent**: In the unfiltered empty branch (no notes AND no subjects), render a Load button
beside the existing "Create a note" CTA. No change to the shared `EmptyState`.

**Contract**: Reuse a small `load-sample-data-button.tsx` client component (button +
`useActionTransition()` + toast) rendered after `<EmptyState>` when `notes.length === 0 &&
subjects.length === 0 && !isFiltered`.

#### 4. Load button component

**File**: `src/features/sample-data/components/load-sample-data-button.tsx`

**Intent**: Shared Load trigger used by both the notes empty state and (optionally) the settings
section.

**Contract**: Client component; fires `loadSampleData` via `useActionTransition()` (`run` +
`isPending`), no props beyond optional label/variant.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Build passes: `pnpm build`

#### Manual Verification:

- Empty account: `/settings` shows Load (not Clear); `/notes` empty state shows Load beside
  Create. Click Load → toast, notes/subjects appear, `/review` has a due queue, dashboard
  due-count > 0.
- Seeded account: `/settings` shows Clear (not Load); `/notes` no longer shows Load. Click Clear
  → toast, account empty again.
- A failure path (simulate by temporarily breaking an insert) leaves the account empty, not
  half-seeded.

---

## Phase 5: E2E + full-suite verification

### Overview

Automated end-to-end coverage of the load/clear flow, then the full per-slice gate.

### Changes Required:

#### 1. E2E spec

**File**: `e2e/sample-data.spec.ts`

**Intent**: Cover the demo flow and gating on a fresh account.

**Contract**: Fresh sign-up (`uniqueEmail`, fresh-per-test — this spec asserts clean-slate
counts, so no shared session) → `/notes` empty state shows Load → click → notes + subjects
render and `/review` has at least one due card → `/settings` shows Clear, not Load → click Clear
→ account empty again, Load reappears. Target elements via `data-testid` (lesson: testid for
targeting), e.g. `sample-data-load` / `sample-data-clear`. Add the testids to the components.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit tests pass: `pnpm test`
- Build passes: `pnpm build`
- E2E passes (best-effort): `pnpm test:e2e` — with the local Supabase stack up; if the
  documented GoTrue sign-up flake blocks it, retry (`retries: 2` is configured) and otherwise
  fall back to manual verification (don't hard-gate, per lesson).

#### Manual Verification:

- Full demo flow verified by hand on a production build (`pnpm build && pnpm start`) at least
  once, since perceived speed/UX must be judged on the prod bundle, not `next dev` (lesson).

---

## Testing Strategy

### Unit Tests:

- `remap`: foreign-key resolution (note→subject, card→note), `position` preservation,
  `is_seeded` set on all rows, empty-fixture edge case.

### Integration / E2E Tests:

- `e2e/sample-data.spec.ts`: fresh account → load → populated + due queue → clear → empty, with
  gating (Load↔Clear visibility) asserted at each step.

### Manual Testing Steps:

1. `supabase db reset`, then `pnpm seed:dump-fixture` and confirm `sample-data.ts` regenerates.
2. Sign up a brand-new account; confirm `/notes` and `/settings` show Load.
3. Load → verify notes/subjects/cards appear, `/review` has due cards, dashboard due-count > 0.
4. Clear → verify account empty, Load reappears, no seeded rows remain.
5. Verify a second account is unaffected (RLS isolation) — its data is neither shown nor cleared.

## Performance Considerations

Gating queries are `head: true` counts scoped by RLS — negligible. The load inserts are bounded
by the fixture size (the `test@gmail.com` corpus, low hundreds of rows) and run once per
explicit user click; three batched inserts, not row-by-row.

## Migration Notes

One additive migration (`is_seeded` on three tables); no backfill (default `false` is correct
for existing rows). Apply locally via `supabase db reset`; Vercel applies migrations on deploy.
After the migration, regenerate the Supabase `Database` types and run `pnpm seed:dump-fixture`
to (re)produce the fixture from the now-current local corpus.

## References

- Design spec: `docs/superpowers/specs/2026-06-06-seed-sample-data-design.md`
- Roadmap slice: `context/foundation/roadmap.md` → S-12
- Patterns: `src/features/account/actions/delete-account.ts` (RPC action),
  `src/features/settings/actions/update-daily-goal.ts` (upsert + revalidate),
  `src/components/ui/empty-state.tsx`, `supabase/seed.sql` (content source, read-only)
- Lessons: `context/foundation/lessons.md` (updated_at trigger; E2E sign-up flake; stage by
  explicit path; testid selectors; measure perf in prod build)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Marker migration

#### Automated

- [x] 1.1 Migration applies cleanly: `supabase db reset` — ebd022e
- [x] 1.2 Type checking passes: `pnpm typecheck` — ebd022e
- [x] 1.3 Linting passes: `pnpm lint` — ebd022e

#### Manual

- [x] 1.4 `is_seeded boolean not null default false` present on subjects, notes, memory_cards — ebd022e

### Phase 2: Fixture generator + committed fixture

#### Automated

- [x] 2.1 Dump runs against a reset local DB: `pnpm seed:dump-fixture` — 115a9aa
- [x] 2.2 Generated file imports + type-checks: `pnpm typecheck` — 115a9aa
- [x] 2.3 Linting passes: `pnpm lint` — 115a9aa

#### Manual

- [x] 2.4 Fixture contains expected subjects/notes-with-code/cards, counts ≈ corpus — 115a9aa

### Phase 3: Gating queries + Server Actions

#### Automated

- [x] 3.1 Unit tests pass: `pnpm test` — 2f0c5e3
- [x] 3.2 Type checking passes: `pnpm typecheck` — 2f0c5e3
- [x] 3.3 Linting passes: `pnpm lint` — 2f0c5e3

#### Manual

- [ ] 3.4 Fresh account: load populates owned `is_seeded` rows; clear removes exactly them; reload after clear works

### Phase 4: UI wiring

#### Automated

- [x] 4.1 Type checking passes: `pnpm typecheck` — 0c0c4ef
- [x] 4.2 Linting passes: `pnpm lint` — 0c0c4ef
- [x] 4.3 Build passes: `pnpm build` — 0c0c4ef

#### Manual

- [ ] 4.4 Empty account shows Load (settings + notes); seeded account shows Clear; flows produce toasts and correct state
- [ ] 4.5 Simulated insert failure leaves the account empty, not half-seeded

### Phase 5: E2E + full-suite verification

#### Automated

- [x] 5.1 Type checking passes: `pnpm typecheck`
- [x] 5.2 Linting passes: `pnpm lint`
- [x] 5.3 Unit tests pass: `pnpm test`
- [x] 5.4 Build passes: `pnpm build`
- [x] 5.5 E2E passes (best-effort, `retries: 2`): `pnpm test:e2e` — sample-data.spec green; full-suite reds are the documented GoTrue sign-up flake (all die in signUp→/dashboard) + 1 unrelated memory-card-add failure; daily-goal/action-feedback (my edited surfaces) pass in isolation → no regression

#### Manual

- [ ] 5.6 Full demo flow verified by hand on a production build (`pnpm build && pnpm start`)
