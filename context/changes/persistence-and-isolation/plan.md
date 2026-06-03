# Persistence & Per-User Isolation (F-02) Implementation Plan

## Overview

Create the repo's **first database migration**: three core domain tables — `notes`, `topic_checks`, `review_events` — with Row-Level Security policies that scope every row to its owner via `(select auth.uid())`. Generate the `Database` TypeScript type and thread it into both Supabase client factories, add a minimal typed read-access layer, and prove the isolation guardrail with a two-account test. Mutations and UI are explicitly deferred to the vertical slices (S-01 notes, S-03 recall loop, S-05 deletion).

## Current State Analysis

From `context/changes/persistence-and-isolation/research.md` (internal + Context7 external legs):

- `supabase/migrations/` **does not exist** — this change creates it. `supabase/config.toml` has `[db.migrations] enabled=true`, `[db.seed] enabled=true` (`sql_paths=["./seed.sql"]`, file absent), DB `major_version=17`, local `[auth.email] enable_confirmations=false` (test users instantly active).
- Two Supabase client factories, **both untyped** (no `Database` generic): `src/lib/supabase/server.ts:1-25` (async, cookie-bound; the factory all server contexts use) and `src/lib/supabase/client.ts:1-8` (browser).
- Isolation is **RLS-by-design**: no `SUPABASE_SERVICE_ROLE_KEY` is read anywhere (`src/lib/env.ts:9-23`); the anon client + session cookie + `auth.uid()` is the only data path. No service-role bypass exists and the plan keeps it that way.
- `runAuthAction` (`src/features/auth/run-auth-action.ts:13-26`) is hard-typed to Supabase's auth `{ error }` envelope — it does **not** fit PostgREST `{ data, error }`. F-02 introduces a separate table-aware wrapper.
- **First-of-kind in this repo:** first migration, first generated `Database` type, first data-access layer (no `.from()` table read exists today), first `revalidatePath`/`revalidateTag` (not used yet — but mutations are out of scope here, so this stays deferred).
- Conventions to extend: `ActionResultT` (`src/types/action.ts:2`), per-field + composed-object Zod schemas in `schemas.ts`, `validateInput` (`src/features/auth/validate.ts:4-14`), feature-first layout (`AGENTS.md` — domain code born in `src/features/<domain>/`, kebab-case dirs).
- Supabase CLI `2.101.0` pinned in `mise.toml`, host-only. Zero db/typegen scripts in `package.json` today. E2E harness exists: `e2e/auth.spec.ts`, `pnpm test:e2e` (Playwright, system Chrome, production build, requires `supabase start`).

## Desired End State

After this plan: a committed migration creates the three tables with RLS enforced at the DB; `src/lib/supabase/types.ts` exists and both factories are `createServerClient<Database>` / `createBrowserClient<Database>`; typed read helpers exist under each feature; and `pnpm test:e2e` includes a passing isolation spec proving account B cannot read account A's rows (and vice versa). `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` all green.

### Key Discoveries:

- RLS perf idiom (Context7): use `(select auth.uid())` not bare `auth.uid()` — triggers an `initPlan` cache; and **btree-index every policy column** (`user_id`, FK columns). Source: `troubleshooting/rls-performance-and-best-practices`.
- Per-action policies scoped `to authenticated`, with `with check` on write policies, is the documented isolation pattern (`addTodos.sql`, `row-level-security.mdx`).
- Typegen command settled: `supabase gen types typescript --local > src/lib/supabase/types.ts` (CLI 2.101.0), then add the `<Database>` generic to both factories.
- F-02 has **no notes UI** — the isolation test seeds + asserts via authenticated `supabase-js` clients, with sign-up driven through the real UI (see Critical Implementation Details).

## What We're NOT Doing

- **No mutation Server Actions** (create/update/delete) — deferred to S-01/S-03/S-05.
- **No notes/review UI** — deferred to the slices.
- **No SM-2 write logic** (ease/interval math, the `record_review` path) — S-03 owns it. F-02 only creates the columns + index.
- **No `revalidatePath`/`revalidateTag`** — first mutation introduces it.
- **No service-role client / `SUPABASE_SERVICE_ROLE_KEY`** — would breach the RLS-only isolation model.
- **No `seed.sql`** — the test creates its own data.
- **No hosted `db push`** — local migration only this change; hosted apply happens when a slice deploys.

## Implementation Approach

Bottom-up, each phase independently verifiable: schema+RLS first (the contract), then make TypeScript aware of it (typegen), then a thin typed read layer, then prove isolation end-to-end. The migration is a single atomic file because the three tables share an FK cascade chain that must be created in dependency order (`notes` → `topic_checks` → `review_events`).

## Critical Implementation Details

- **Isolation test without a UI.** Mutations/UI are out of scope, so the Playwright spec cannot click through a notes screen. It drives the **real sign-up UI** for accounts A and B (exercising F-01's auth + cookie + proxy path), then for data ops constructs a **`supabase-js` client per account authenticated via `signInWithPassword(email, password)`** using the test's own credentials — **not** by reusing the browser session token. `@supabase/ssr` stores the session as HttpOnly, base64-chunked `sb-*-auth-token` cookies, so there is no JS-accessible token to scrape; `signInWithPassword` returns the `access_token` directly and `supabase-js` (`^2.106.2`) is already a dependency. This is real RLS through a real session — the only honest shape given no mutation action exists yet.
- **Test-process env loading.** `playwright.config.ts` currently loads no `.env` (it only reads `process.env.CI`); the webServer gets `.env.local` because Next loads it natively, but a Playwright **spec** process does not, and `@/lib/env` is a Next path alias unreachable from the raw test runner. So Phase 4 must make `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` reachable to the spec: load them in `playwright.config.ts` (add `dotenv` as a dev dep, or read the deterministic well-known local anon key). The spec must source URL/anon-key itself, not assume `process.env` is populated.
- **Read-helper testability.** Repo read helpers normally call `createClient()` (server, `next/headers` cookies), which only has a session inside a request. To let the isolation test exercise the _same_ query path it asserts on, the table wrapper / read helpers must **accept an injected `SupabaseClient<Database>`** (defaulting to `createClient()` in app code). Without injection the helpers can't run under the test's two-client setup.
- **`with check` vs `using`.** `using` governs row _visibility_ (select/update/delete); `with check` governs _what a write may produce_ (insert/update). Both must reference `(select auth.uid()) = user_id` so a user can neither read nor write another's rows. Missing `with check` on insert would let a user insert rows owned by someone else — the exact guardrail breach to prevent.
- **`default auth.uid()` + NOT NULL on `user_id`.** Makes owner-spoofing on insert impossible without a custom client, and aligns the default with the `with check`.

## Phase 1: Migration — schema, RLS, indexes

### Overview

One timestamped SQL file creates all three tables, the FK cascade chain, RLS policies, and indexes. Applied locally with `supabase db reset`.

### Changes Required:

#### 1. First migration file

**File**: `supabase/migrations/<timestamp>_init_notes_topic_checks_review_events.sql` (created via `supabase migration new init_notes_topic_checks_review_events`)

**Intent**: Define the three core tables, scope every row to its owner, and index for RLS performance. This is the persistence contract the whole product sits on.

**Contract**:

- `notes`: `id uuid pk default gen_random_uuid()`, `user_id uuid not null references auth.users(id) on delete cascade default auth.uid()`, `title text`, `content text not null default ''`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`.
- `topic_checks`: `id uuid pk`, `user_id uuid not null references auth.users(id) on delete cascade default auth.uid()`, `note_id uuid not null references notes(id) on delete cascade`, `prompt text not null`, plus **SM-2 scheduling columns (present, unwritten until S-03)**: `ease_factor real not null default 2.5`, `interval_days integer not null default 0`, `repetitions integer not null default 0`, `due_at timestamptz not null default now()`, `created_at`/`updated_at`.
- `review_events`: `id uuid pk`, `user_id uuid not null references auth.users(id) on delete cascade default auth.uid()`, `topic_check_id uuid not null references topic_checks(id) on delete cascade`, `rating smallint not null check (rating between 0 and 5)` (**SM-2 0–5 quality — locked decision**), `reviewed_at timestamptz not null default now()`.
- Each table: `alter table <t> enable row level security;` then four per-action policies `to authenticated` — `select`/`update`/`delete` with `using ((select auth.uid()) = user_id)`, `insert`/`update` with `with check ((select auth.uid()) = user_id)`.
- Indexes: `create index … using btree (user_id)` on all three; `(note_id)` on `topic_checks`; `(topic_check_id)` on `review_events`; `(user_id, due_at)` on `topic_checks` (the S-03 "what's due" query).
- `updated_at` auto-touch trigger is **out of scope** (no updates happen in F-02); columns default to `now()`.

### Success Criteria:

#### Automated Verification:

- `supabase db reset` applies the migration with no errors
- `psql` / Studio shows RLS enabled on all three tables and four policies each
- `pnpm typecheck` still passes (no app code changed yet)

#### Manual Verification:

- In Studio, confirm the FK cascade chain and that `due_at`/`ease_factor` defaults are present
- Confirm policies read `(select auth.uid())`, not bare `auth.uid()`

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 2.

---

## Phase 2: Typegen + typed clients

### Overview

Generate `Database` types from the local schema and thread the generic into both client factories.

### Changes Required:

#### 1. Generated types file

**File**: `src/lib/supabase/types.ts` (new, generated — do not hand-edit)

**Intent**: Give TypeScript knowledge of the schema so `.from('notes')` is typed.

**Contract**: Output of `supabase gen types typescript --local > src/lib/supabase/types.ts`. Exports `Database`. Consider adding a `db:types` script to `package.json` for repeatability (optional).

#### 2. Type the factories

**File**: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`

**Intent**: Make every client schema-aware.

**Contract**: `createServerClient<Database>(...)` and `createBrowserClient<Database>(...)`, importing `Database` from `@/lib/supabase/types`. No other signature change.

### Success Criteria:

#### Automated Verification:

- `src/lib/supabase/types.ts` exists and exports `Database`
- `pnpm typecheck` passes with the generic wired
- `pnpm lint` passes

#### Manual Verification:

- In an editor, `(await createClient()).from('notes').select()` shows typed columns

**Implementation Note**: Pause for human confirmation before Phase 3.

---

## Phase 3: Typed read-access layer

### Overview

A feature-local `{data,error}`-typed table wrapper plus thin typed read helpers under each feature, following the feature-first layout. Read-only — no mutations.

### Changes Required:

#### 1. Table-aware query wrapper

**File**: `src/features/notes/run-table-query.ts` (feature-local; promote to shared tier on the 2nd consumer per AGENTS.md)

**Intent**: Centralize the PostgREST `{ data, error }` → typed-result normalization, the table analogue of `runAuthAction`. Reusable for mutations when slices add them.

**Contract**: A generic helper that takes a `SupabaseClient<Database>` (**injectable** — see Critical Implementation Details) and a query thunk, awaits it, and either returns typed `data` or throws/normalizes the error. Returns typed rows for reads; does not force reads through `ActionResultT`.

#### 2. Thin read helpers per feature

**File**: `src/features/notes/queries.ts`, `src/features/topic-checks/queries.ts`, `src/features/review-events/queries.ts` (kebab-case dirs; tables are `topic_checks`/`review_events`)

**Intent**: First data-access layer in the repo — typed reads scoped automatically by RLS.

**Contract**: e.g. `getNotes(client?)`, `getTopicChecksDue(client?)`, `getReviewEvents(topicCheckId, client?)` — each accepts an optional injected `SupabaseClient<Database>` (defaults to `await createClient()`), returns typed rows. Co-locate row `*T` types in each feature's `types.ts` (re-export from generated `Database` rows). No `schemas.ts` needed unless a helper takes validated input (reads here don't). **Note (F3):** `getTopicChecksDue` must carry a code comment that `due_at` defaults to `now()` and nothing writes it until S-03, so it returns **all** rows by design until the SM-2 write path lands — not a bug.

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck` passes — helpers are typed against `Database`
- `pnpm lint` passes
- `pnpm test` passes (any unit coverage added)

#### Manual Verification:

- Helper signatures read cleanly and accept an injected client
- `rm -rf src/features/notes` would leave no orphan imports (feature-first deletion test holds)

**Implementation Note**: Pause for human confirmation before Phase 4.

---

## Phase 4: Two-account isolation E2E

### Overview

A Playwright spec proving the PRD's #1 guardrail: no user reads another's rows. Sign-up via real UI; data ops via authenticated `supabase-js` clients.

### Changes Required:

#### 1. Isolation spec

**File**: `e2e/isolation.spec.ts` (sibling of `e2e/auth.spec.ts`)

**Intent**: Commit the isolation contract as an executable test.

**Contract**: (1) Sign up account A through the real sign-up UI; (2) build A's `supabase-js` client via `signInWithPassword(emailA, password)` and insert a `notes` row; (3) sign up account B; (4) build B's client the same way and assert `getNotes()` (or `.from('notes').select()`) returns **zero** of A's rows; (5) assert the reverse. URL + anon key sourced from env loaded in `playwright.config.ts` (see Critical Implementation Details), **not** from `process.env` assumed-present in the spec. Reuse the existing Playwright config (system Chrome, production build, local stack). Unique per-run emails to avoid collisions (`enable_confirmations=false` means accounts are immediately active).

**Prerequisite**: `playwright.config.ts` loads `.env.local` (add `dotenv` dev dep, or inline the deterministic local anon key) so the spec can construct `supabase-js` clients.

### Success Criteria:

#### Automated Verification:

- `pnpm test:e2e` passes including the new `isolation.spec.ts`
- Existing `auth.spec.ts` still green (no regression)

#### Manual Verification:

- Temporarily relaxing a policy (e.g. dropping `using`) makes the test **fail** — confirms it actually exercises RLS, not a vacuous pass (revert after)
- Server confirmed bound by PID/port before trusting the run (per `lessons.md` — stale-server false-positive)

**Implementation Note**: Final phase — confirm all four phases' automated + manual criteria before `/10x-impl-review` and `/10x-archive`.

---

## Testing Strategy

### Unit Tests:

- Optional Vitest coverage for read helpers (typed shape, error normalization in the wrapper)

### Integration / E2E Tests:

- `isolation.spec.ts` — two-account RLS isolation (the core deliverable)
- Negative control: a relaxed policy must break the test (verified manually, reverted)

### Manual Testing Steps:

1. `supabase db reset` → inspect tables/policies/indexes in Studio (`localhost:54323`)
2. Wire types, open `queries.ts`, confirm typed columns
3. `pnpm test:e2e` with the local stack up; confirm the new spec passes and auth specs don't regress

## Performance Considerations

- `(select auth.uid())` subquery wrap + btree indexes on every policy/FK column are in the migration by design (Context7 RLS best practice). The `(user_id, due_at)` composite index pre-optimizes the S-03 "what's due now" query before that slice exists.

## Migration Notes

- First migration in the repo; creates `supabase/migrations/`. Apply locally with `supabase db reset` (re-runs all migrations; no prior data to preserve). DB `major_version=17` — any future hosted `db push` target must match.
- No data backfill (no existing rows).

## References

- Internal + external research: `context/changes/persistence-and-isolation/research.md`
- Client factories to type: `src/lib/supabase/server.ts:1-25`, `src/lib/supabase/client.ts:1-8`
- Action/result conventions to extend: `src/features/auth/run-auth-action.ts:13-26`, `src/types/action.ts:2`
- E2E harness to mirror: `e2e/auth.spec.ts`, `package.json` (`test:e2e`)
- Standing lessons: `context/foundation/lessons.md` (verify against a server confirmed bound)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migration — schema, RLS, indexes

#### Automated

- [x] 1.1 `supabase db reset` applies the migration with no errors — 79abbb0
- [x] 1.2 RLS enabled on all three tables, four policies each (Studio/psql) — 79abbb0
- [x] 1.3 `pnpm typecheck` passes — 79abbb0

#### Manual

- [x] 1.4 FK cascade chain + scheduling-column defaults confirmed in Studio — 79abbb0
- [x] 1.5 Policies use `(select auth.uid())`, not bare `auth.uid()` — 79abbb0

### Phase 2: Typegen + typed clients

#### Automated

- [x] 2.1 `src/lib/supabase/types.ts` exists and exports `Database` — 93cc63a
- [x] 2.2 `pnpm typecheck` passes with `<Database>` wired into both factories — 93cc63a
- [x] 2.3 `pnpm lint` passes — 93cc63a

#### Manual

- [x] 2.4 `.from('notes').select()` shows typed columns in editor — 93cc63a

### Phase 3: Typed read-access layer

#### Automated

- [x] 3.1 `pnpm typecheck` passes — helpers typed against `Database` — d4ad12e
- [x] 3.2 `pnpm lint` passes — d4ad12e
- [x] 3.3 `pnpm test` passes — d4ad12e

#### Manual

- [x] 3.4 Read helpers accept an injected client; signatures clean — d4ad12e
- [x] 3.5 Feature-first deletion test holds (no orphan imports) — d4ad12e

### Phase 4: Two-account isolation E2E

#### Automated

- [x] 4.1 `pnpm test:e2e` passes including `isolation.spec.ts`
- [x] 4.2 Existing `auth.spec.ts` still green

#### Manual

- [x] 4.3 Relaxing a policy makes the test fail (negative control), then reverted
- [x] 4.4 Server confirmed bound by PID/port before trusting the run
