# Account Self-Deletion & Owned-Data Teardown (S-05) Implementation Plan

## Overview

Give a signed-in user a `/settings` "Danger zone" to permanently delete their own account and all owned data. Deletion runs through a `SECURITY DEFINER` Postgres RPC (`public.delete_account()`) called on the normal authenticated client — **no `SUPABASE_SERVICE_ROLE_KEY` is introduced**, preserving F-02's RLS-only isolation model. Owned-data teardown (`notes` → `topic_checks` → `review_events`) is already guaranteed by F-02's `on delete cascade` chain off `auth.users`, so this change writes zero row-deletion logic. A type-to-confirm gate ("DELETE") fronts the irreversible action; after the RPC the action signs the user out and redirects to `/sign-in?deleted=1`.

## Current State Analysis

From the decision-locked `change.md` and grounding of the current worktree base (`d84c369`, includes F-01 + F-02 + S-01 p1):

- **`(protected)/` has only `dashboard`** (`src/app/(protected)/dashboard/page.tsx`) — no `/settings` route. The `(protected)/layout.tsx:8-14` gate calls `getUser()` and redirects unauthenticated users to `/sign-in`.
- **`sign-out.ts` is the action shape to mirror** (`src/features/auth/actions/sign-out.ts:7-11`): a `'use server'` function that calls `supabase.auth.signOut()` then `redirect('/sign-in')`, no wrapper, no input.
- **`runAuthAction`** (`src/features/auth/run-auth-action.ts:13-26`) normalizes a Supabase `{ error }` to `ActionResultT` and does NOT redirect (callers redirect). `ActionResultT` = `{ success: true } | { success: false; error: string }` (`src/types/action.ts:2`).
- **`alert-dialog` exists but is unused** (`src/components/ui/alert-dialog.tsx`); `button` has a `destructive` variant (`src/components/ui/button.tsx:19-20`). `AlertDialogAction`/`AlertDialogCancel` accept a `variant` prop.
- **No `.rpc()` call exists yet**; `src/lib/supabase/types.ts` `public.Functions` is empty (`[_ in never]: never`) — it must be regenerated after the migration so `supabase.rpc('delete_account')` is typed.
- **Migration conventions** (`supabase/migrations/20260603070945_init_notes_topic_checks_review_events.sql`): timestamped filename, `-- <slice>:` header, section rules `-- ====`, applied locally via `supabase db reset`.
- **Proxy** (`src/proxy.ts`): auth routes bounce signed-in users to `/dashboard`; `/sign-in` is public. A `?deleted=1` query on `/sign-in` is unaffected by the proxy.
- **`useAppForm`** (`src/components/forms/`) is only needed for multi-field forms; a single destructive button + one confirm input does not require it (mirror the direct-action pattern, with a small client component holding the typed-confirm state).

## Desired End State

A signed-in user visits `/settings`, opens the Danger zone, types `DELETE` to enable the destructive button, confirms in the alert dialog, and is redirected to `/sign-in?deleted=1` showing a "your account and data were deleted" notice. The account no longer exists (cannot sign in again) and every owned row across the three tables is gone via cascade. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` all green.

### Key Discoveries:

- A user cannot `delete from auth.users` directly — that table is owned by `supabase_auth_admin` and `authenticated` has no delete grant. A `SECURITY DEFINER` function owned by a privileged role is the sanctioned, no-service-role path.
- `auth.uid()` scoping must live **inside** the function (`where id = (select auth.uid())`) — the function runs privileged, so RLS does not protect it; the predicate is the entire security model.
- `set search_path = ''` + fully-qualified names is mandatory on the definer function to close the search-path privilege-escalation hole (Supabase's linter flags its absence).
- Supabase JWTs are stateless: deleting the user invalidates the refresh token but the issued access token lives until expiry, so the action MUST `signOut()` (clear the cookie) before/at redirect.

## What We're NOT Doing

- **No `SUPABASE_SERVICE_ROLE_KEY` / admin client** — the locked decision; the RPC replaces it.
- **No row-deletion logic** — F-02's `on delete cascade` chain handles all owned data.
- **No password re-authentication** — type-to-confirm is the chosen friction (re-auth is out of scope for the MVP).
- **No soft-delete / grace period / data export** — deletion is immediate and permanent.
- **No broader settings content** — only the Danger zone; the `/settings` page is a stub other slices (e.g. S-04) can extend.
- **No hosted `db push`** — local migration only, per the project's deferral of hosted apply until a slice deploys.

## Implementation Approach

Bottom-up, mirroring F-02's shape: DB contract first (the RPC + regenerated types), then the feature (action + UI + the sign-in notice), then an executable lifecycle test. The migration is a single file (one function + its grants). The action self-redirects on success (no post-success UI state to preserve) but returns `ActionResultT` on failure so the Danger-zone component can render an inline error.

## Critical Implementation Details

- **Definer-function privilege is the #1 thing to verify, not assume.** On `supabase db reset`, confirm `delete_account()` can actually delete from `auth.users`. Migrations run as the `postgres` role; if the function (owned by `postgres`) cannot delete the auth row, the fix is to own it as `supabase_auth_admin` or add an explicit grant. Test this before building the UI — it's the load-bearing assumption (per `lessons.md` verify-against-reality).
- **Session teardown ordering.** The action calls `rpc('delete_account')`, and only on a null error proceeds to `signOut()` then `redirect('/sign-in?deleted=1')`. `redirect()` throws to unwind, so it must come after `signOut()`. If the RPC errors, return `{ success: false, error }` and do NOT sign out.
- **Typegen after the migration.** `supabase.rpc('delete_account')` only type-checks once `types.ts` is regenerated; do the regen inside Phase 1 so Phase 2 compiles.

## Phase 1: Migration — `delete_account()` RPC + typegen

### Overview

One timestamped migration defines the `SECURITY DEFINER` function and its grants; regenerate the `Database` types so the RPC is typed. Applied locally with `supabase db reset`.

### Changes Required:

#### 1. Migration file

**File**: `supabase/migrations/<timestamp>_add_delete_account_rpc.sql` (via `supabase migration new add_delete_account_rpc`)

**Intent**: Provide a privileged, fully-scoped function that deletes only the caller's own `auth.users` row, so an authenticated client can self-delete without a service-role key. Cascade does the rest.

**Contract**:

- `create function public.delete_account() returns void language sql security definer set search_path = '' as $$ delete from auth.users where id = (select auth.uid()); $$;`
- `revoke execute on function public.delete_account() from public, anon;`
- `grant execute on function public.delete_account() to authenticated;`
- Header comment in the F-02 style (`-- S-05 delete-account-and-data: …`), noting the `search_path`/`auth.uid()` safety rationale inline.

#### 2. Regenerate types

**File**: `src/lib/supabase/types.ts` (generated — do not hand-edit)

**Intent**: Make `supabase.rpc('delete_account')` type-check.

**Contract**: Output of `supabase gen types typescript --local > src/lib/supabase/types.ts`; `public.Functions` now includes `delete_account` (Args `Record<PropertyKey, never>`, Returns `undefined`/`void`).

### Success Criteria:

#### Automated Verification:

- `supabase db reset` applies the migration with no errors
- `src/lib/supabase/types.ts` `public.Functions` includes `delete_account`
- `pnpm typecheck` passes

#### Manual Verification:

- In Studio/psql, calling `select public.delete_account()` as an authenticated role deletes that user and (by cascade) their rows; confirm the function actually has privilege to delete from `auth.users` (the load-bearing check)
- Function definition shows `security definer` and `search_path = ''`

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 2.

---

## Phase 2: Server action + settings Danger zone + sign-in notice

### Overview

The feature: a server action that runs the RPC and tears down the session, a `/settings` page with a Danger zone, the type-to-confirm client component, a dashboard link, and the `?deleted=1` notice on sign-in.

### Changes Required:

#### 1. Delete-account server action

**File**: `src/features/account/actions/delete-account.ts` (new `account` feature; born here per feature-first)

**Intent**: Delete the account and end the session. New feature folder because account-lifecycle is its own domain, distinct from `auth` (sign-in/up) — though it reuses the auth client.

**Contract**: `'use server'`; `async function deleteAccount(): Promise<ActionResultT>`. Calls `await createClient()`, then `const { error } = await supabase.rpc('delete_account')`; on error → `console.error` + `return { success: false, error: error.message }`; on success → `await supabase.auth.signOut()` then `redirect('/sign-in?deleted=1')`. (Mirrors `sign-out.ts` for the success path, `runAuthAction`'s envelope for the error path.)

#### 2. Settings page (Danger zone)

**File**: `src/app/(protected)/settings/page.tsx` (new route; gated by the existing `(protected)/layout.tsx`)

**Intent**: A settings surface whose only content for now is a Danger zone hosting the delete control. Server Component; renders the client delete component.

**Contract**: Server Component default export; a "Danger zone" section heading + short copy; renders `<DeleteAccountDialog />`. No data fetching needed.

#### 3. Delete-account client component (type-to-confirm)

**File**: `src/features/account/components/delete-account-dialog.tsx` (new)

**Intent**: Front the irreversible action with an `alert-dialog` and a type-`DELETE` gate; invoke the server action and surface inline errors.

**Contract**: `'use client'`. A `destructive` trigger button opens `AlertDialog`; inside, a controlled text input; `AlertDialogAction` (variant `destructive`) stays `disabled` until the input value `=== 'DELETE'`. On confirm, call `deleteAccount()` inside a transition; if it returns `{ success: false }`, render the error (reuse `FormError` if suitable) and keep the dialog open. Success path redirects server-side, so no client navigation needed.

#### 4. Dashboard → settings link

**File**: `src/app/(protected)/dashboard/page.tsx` (edit)

**Intent**: Make the settings surface reachable.

**Contract**: Add a link to `/settings` (e.g. a "Settings" link/button near the sign-out control). Minimal edit; no layout restructure.

#### 5. Sign-in `?deleted=1` notice

**File**: `src/app/(auth-pages)/sign-in/page.tsx` (edit) + a new sibling notice subcomponent

**Intent**: Confirm to the user that deletion succeeded after the redirect.

**Contract**: `sign-in/page.tsx` is a `'use client'` component, so it **cannot** read a server `searchParams` prop — the param must come from `useSearchParams()` (`next/navigation`). In Next 16 an un-suspended `useSearchParams()` on this statically-rendered route fails `next build` ("should be wrapped in a suspense boundary"), and Phase 3's E2E runs a real `pnpm build`, so this must be suspended. Extract a small client subcomponent (e.g. `DeletedNotice`) that calls `useSearchParams()` and renders a one-line notice ("Your account and all data were deleted.") above the form when `get('deleted') === '1'`; render it inside a `<Suspense>` boundary in the page. Reuse the `FormError`/notice markup for visual consistency (there is no existing search-param notice pattern to mirror — the current `FormError` is `useState`-driven from form submission only).

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck` passes
- `pnpm lint` passes
- `pnpm test` passes

#### Manual Verification:

- `/settings` renders the Danger zone; the destructive button is disabled until `DELETE` is typed
- Confirming deletes the account and lands on `/sign-in?deleted=1` with the notice visible
- The deleted account cannot sign in again; a fresh sign-up with a new email still works
- An RPC error (simulated) surfaces inline and does NOT sign the user out

**Implementation Note**: Pause for human confirmation before Phase 3.

---

## Phase 3: E2E account-lifecycle test

### Overview

A Playwright spec proving the full lifecycle: sign up → delete via the real UI → redirected with notice → account is gone.

### Changes Required:

#### 1. Lifecycle spec

**File**: `e2e/delete-account.spec.ts` (sibling of `e2e/auth.spec.ts`, `e2e/isolation.spec.ts`)

**Intent**: Commit the deletion contract as an executable test through the real UI.

**Contract**: (1) Sign up a unique account via the real UI (reuse the `uniqueEmail`/`signUp` helper shape from the existing specs); (2) navigate to `/settings`; (3) type `DELETE` and confirm in the dialog; (4) assert redirect to `/sign-in` with the `?deleted=1` notice visible; (5) attempt sign-in with the same credentials and assert it fails (account gone). Reuse the existing Playwright config (system Chrome, production build, local stack).

### Success Criteria:

#### Automated Verification:

- `pnpm test:e2e` passes including `delete-account.spec.ts`
- Existing `auth.spec.ts` and `isolation.spec.ts` still green (no regression)

#### Manual Verification:

- Server confirmed bound by PID/port before trusting the run (per `lessons.md` — kill stale `next-server`, confirm a fresh build bound)

**Implementation Note**: Final phase — confirm all phases' criteria before `/10x-impl-review` and `/10x-archive`.

---

## Testing Strategy

### Unit Tests:

- Optional Vitest coverage is thin here — the logic is a single RPC call + redirect; the E2E carries the real proof.

### Integration / E2E Tests:

- `delete-account.spec.ts` — full sign-up → delete → can't-sign-in lifecycle (the core deliverable).

### Manual Testing Steps:

1. `supabase db reset`; in Studio confirm `delete_account()` exists with `security definer` + `search_path=''` and can delete an `auth.users` row.
2. `pnpm dev` (or the prod build): `/settings` → type `DELETE` → confirm → land on `/sign-in?deleted=1`; verify the account can't sign in again.
3. `pnpm test:e2e` with the local stack up; new spec passes, auth/isolation specs don't regress.

## Performance Considerations

- Negligible: a single-row privileged delete plus cascade. No new indexes needed (the FK columns indexed in F-02 already back the cascade).

## Migration Notes

- Second migration in the repo; additive (new function only, no schema change). Apply locally with `supabase db reset`. Hosted `db push` deferred until a slice deploys.
- **Hosted-privilege caveat (re-verify on first hosted apply):** Phase 1's privilege check passes locally because the local `postgres` role is effectively superuser, so the definer fn can delete from `auth.users` regardless of grants. On hosted Supabase `postgres` is NOT a superuser and may lack delete on the `supabase_auth_admin`-owned `auth.users` — a green LOCAL check does not prove the hosted case. When this slice first deploys, re-verify the delete works hosted; fallback is to own the function as `supabase_auth_admin` (or add an explicit grant).
- No data backfill.

## References

- Decision-locked identity: `context/changes/delete-account-and-data/change.md`
- Action shape to mirror: `src/features/auth/actions/sign-out.ts:7-11`; error envelope: `src/features/auth/run-auth-action.ts:13-26`
- F-02 cascade + RLS (guarantees data teardown): `supabase/migrations/20260603070945_init_notes_topic_checks_review_events.sql`
- E2E harness to mirror: `e2e/auth.spec.ts`, `e2e/isolation.spec.ts`
- Standing lessons: `context/foundation/lessons.md` (verify against a server confirmed bound)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migration — `delete_account()` RPC + typegen

#### Automated

- [ ] 1.1 `supabase db reset` applies the migration with no errors
- [ ] 1.2 `src/lib/supabase/types.ts` `public.Functions` includes `delete_account`
- [ ] 1.3 `pnpm typecheck` passes

#### Manual

- [ ] 1.4 `select public.delete_account()` as an authenticated role deletes the user + cascades; privilege to delete from `auth.users` confirmed
- [ ] 1.5 Function shows `security definer` and `search_path = ''`

### Phase 2: Server action + settings Danger zone + sign-in notice

#### Automated

- [ ] 2.1 `pnpm typecheck` passes
- [ ] 2.2 `pnpm lint` passes
- [ ] 2.3 `pnpm test` passes

#### Manual

- [ ] 2.4 `/settings` Danger zone renders; destructive button disabled until `DELETE` typed
- [ ] 2.5 Confirming deletes the account and lands on `/sign-in?deleted=1` with the notice
- [ ] 2.6 Deleted account cannot sign in again; fresh sign-up still works
- [ ] 2.7 Simulated RPC error surfaces inline and does NOT sign the user out

### Phase 3: E2E account-lifecycle test

#### Automated

- [ ] 3.1 `pnpm test:e2e` passes including `delete-account.spec.ts`
- [ ] 3.2 Existing `auth.spec.ts` and `isolation.spec.ts` still green

#### Manual

- [ ] 3.3 Server confirmed bound by PID/port before trusting the run
