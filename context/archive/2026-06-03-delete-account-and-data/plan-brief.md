# Account Self-Deletion & Owned-Data Teardown (S-05) — Plan Brief

> Full plan: `context/changes/delete-account-and-data/plan.md`

## What & Why

S-05, the account-lifecycle leaf slice: let a signed-in user permanently delete their own account and all owned data from a `/settings` Danger zone. Satisfies the PRD's account-deletion requirement (FR-006) and closes the data-lifecycle story. It depends only on F-01 + F-02 (both done), so it ships independently of the notes/recall slices.

## Starting Point

Worktree branched off `main` HEAD (`d84c369`): F-01 auth/session + F-02 tables/RLS/cascade + S-01 p1 are present. `(protected)/` has only `dashboard`; no `/settings`. `sign-out.ts` is the action pattern to mirror; `alert-dialog` exists but is unused; no `.rpc()` calls yet and `types.ts` `Functions` is empty.

## Desired End State

A user opens `/settings`, types `DELETE` to arm the destructive button, confirms in an alert dialog, and lands on `/sign-in?deleted=1` with a confirmation notice. Their `auth.users` row and every owned row (`notes`/`topic_checks`/`review_events`) are gone; the account can't sign in again.

## Key Decisions Made

| Decision            | Choice                                             | Why                                                                                                    | Source             |
| ------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------ |
| Delete mechanism    | `SECURITY DEFINER` RPC, no service-role key        | Preserves F-02's RLS-only model; the privileged fn is the only exception, fully scoped to `auth.uid()` | Change.md (locked) |
| Owned-data teardown | F-02 `on delete cascade` chain                     | Deleting the auth user wipes all child rows automatically — zero deletion code                         | Change.md (locked) |
| Confirm friction    | Type-to-confirm `DELETE`                           | Strong intent gate, no password handling/round-trip, no full form                                      | Plan               |
| Surface             | New `/settings` page, Danger zone                  | Room to grow (S-04 etc.); dashboard links to it                                                        | Plan               |
| Post-delete         | `/sign-in?deleted=1` + notice                      | Mirrors sign-out redirect, adds explicit confirmation                                                  | Plan               |
| Action shape        | Self-redirect on success, `ActionResultT` on error | Matches `sign-out.ts` success + `runAuthAction` error envelope                                         | Plan               |

## Scope

**In scope:** the `delete_account()` RPC + grants, regenerated types, a server action (rpc → signOut → redirect), `/settings` Danger zone, type-to-confirm client dialog, dashboard link, sign-in `?deleted=1` notice, an E2E lifecycle test.

**Out of scope:** service-role key/admin client, any row-deletion code, password re-auth, soft-delete/grace-period/data-export, broader settings content, hosted `db push`.

## Architecture / Approach

Authenticated client → `supabase.rpc('delete_account')` → `SECURITY DEFINER` Postgres fn (`search_path=''`, deletes `auth.users where id = (select auth.uid())`) → FK `on delete cascade` tears down `notes → topic_checks → review_events`. The server action then `signOut()`s (clears the stateless-JWT cookie) and redirects. UI is a Server-Component settings page hosting a small client `alert-dialog` with a type-to-confirm gate.

## Phases at a Glance

| Phase                            | What it delivers                                                                               | Key risk                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1. Migration + typegen           | `delete_account()` fn + grants; regenerated `types.ts`                                         | Whether the definer fn actually has privilege to delete `auth.users` — verify on `db reset` |
| 2. Action + settings UI + notice | Server action, `/settings` Danger zone, type-to-confirm dialog, dashboard link, sign-in notice | Session teardown ordering (signOut before redirect; don't sign out on RPC error)            |
| 3. E2E lifecycle test            | `delete-account.spec.ts`: sign up → delete → can't sign in                                     | Stale `next-server` false-positive — confirm fresh bound server                             |

**Prerequisites:** F-01 + F-02 (done); local Supabase stack up for migration + E2E.
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- **Definer-function privilege.** Assumes a `postgres`-owned `SECURITY DEFINER` fn can delete from `auth.users` on local Supabase. First thing to verify on `db reset`; fallback is owning the fn as `supabase_auth_admin` or an explicit grant.
- **Stateless JWT.** Access token stays valid until expiry after deletion; the action must `signOut()` to clear the cookie or the user appears logged-in against a deleted account.

## Success Criteria (Summary)

- A user can delete their account from `/settings` behind a type-to-confirm gate and is redirected to a confirming `/sign-in?deleted=1`.
- The deleted account cannot sign in again, and all owned rows are gone (cascade).
- No service-role key enters the codebase; `typecheck`/`lint`/`test`/`test:e2e` all green.
