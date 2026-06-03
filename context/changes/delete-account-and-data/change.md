---
change_id: delete-account-and-data
title: Account self-deletion from settings, with full owned-data teardown
status: implemented
created: 2026-06-03
updated: 2026-06-03
archived_at: null
---

## Notes

S-05 / EX-365. The account-lifecycle leaf slice (Stream B): a signed-in user deletes their own account and all owned data from a settings surface. Depends only on F-01 (auth/session) + F-02 (tables + RLS), both done — no dependency on the notes/recall slices, so it can be built independently and in parallel with S-01.

**Locked decision (do not re-litigate in plan): use a `SECURITY DEFINER` Postgres RPC, NOT the service-role admin API.** A `public.delete_account()` function — `security definer`, `set search_path = ''`, deleting `from auth.users where id = (select auth.uid())`, `execute` granted to `authenticated` and revoked from `public`/`anon` — is called via `supabase.rpc('delete_account')` on the normal authenticated client. This keeps the repo's RLS-only isolation model intact: **no `SUPABASE_SERVICE_ROLE_KEY` is introduced.** Owned-data teardown is already guaranteed by F-02's `on delete cascade` chain (`auth.users → notes → topic_checks → review_events`) — the slice writes no row-deletion logic.

Two correctness points the plan must cover:

- **Verify (don't assume) the definer function can delete from `auth.users`** on `supabase db reset` — function ownership/grants are the first thing to test (per `lessons.md` verify-against-reality).
- **Session teardown after the RPC.** Supabase JWTs are stateless: deleting the user invalidates the refresh token but the access token lives until expiry. The server action must `signOut()` + clear cookies + redirect immediately after the RPC, or the user appears logged-in against a deleted account.

UI uses the existing `alert-dialog` primitive for the destructive confirm. Lean process: `/10x-new` → `/10x-plan` → `/10x-implement` (skip `/10x-research`; F-02 wiring is fresh).
