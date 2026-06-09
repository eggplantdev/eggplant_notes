---
change_id: expose-cli-note-api
title: Expose a CLI/agent HTTP API to add notes + cards via personal API tokens
status: implementing
created: 2026-06-06
updated: 2026-06-09
archived_at: null
---

## Plan refinements (2026-06-08) — supersede where they conflict with Notes below

Two settled deviations from the original Notes, decided during `/10x-plan`:

1. **Service-role DROPPED from the write path (keep RLS).** The original Notes said this would be "the first service-role code path" with the ownership wall in app code. It isn't needed. The repo's own `create_note_with_checks` is `SECURITY INVOKER` and there is no service-role client anywhere — we keep it that way. The ONLY elevated surface is a single `anon`-granted `SECURITY DEFINER` function `resolve_api_token(p_hash) → user_id` (returns a uuid only to a caller already holding the correct token; bumps `last_used_at`). After that we mint a short-lived user-scoped JWT (`jose`, HS256 via `SUPABASE_JWT_SECRET` locally + legacy hosted; asymmetric ES256 is a deploy-time key swap), build a supabase-js client with the `accessToken` option, and reuse the existing INVOKER RPC/actions UNCHANGED so RLS (`user_id = auth.uid()`) is the ownership wall. No `SUPABASE_SERVICE_ROLE_KEY` enters the app.

2. **Surface expanded from "add note (+cards)" to 4 endpoints** — an agent must read structure to decide placement: `GET /api/subjects`, `GET /api/notes` (titles, optional `?subject`), `POST /api/notes` (note + optional cards), `POST /api/memory-cards` (body discriminates: `note_id` → attach to note; `subject_id` → standalone). All four ride the one auth pipeline; reads are RLS-scoped to the token's user by the same minted JWT.

Other settled choices: token = `clc_` + 32 random bytes (base64url), store only `sha256`; `scopes` column stored-not-enforced in Phase 1; rate limiting deferred to Phase 2 (cheap defenses only: short token expiry, non-enumerable hash, Supabase's own limits); the load-bearing isolation gate is a Vitest integration test against local Supabase with two real users.

## Notes

Goal: let a CLI / agent skill add a note (+ its memory cards) over HTTP, e.g. `POST /api/notes`.

**Sequencing — this is the LAST slice**, after the UI and AI-integration work land. Do not start until those are done.

**Auth decision (settled 2026-06-06):** go with **Option C — personal API tokens**, the GitHub-PAT model. Rejected alternatives and why:

- _Password in CLI config → JWT_: simplest, but storing a user password on disk is a no-go for real users (brute-force surface, no per-device revoke).
- _Magic-link / OTP + Supabase session (indefinite)_: fixes password storage and is RLS-native, but "contained but blind" — no audit, blunt all-or-nothing revoke, no auto-expiry. Doesn't survive real third-party users.
- _Allowlist webhook to own user_id_: fine if CLI were a you-only tool; rejected because this is intended as a real-user feature.

**Shape of C:**

- New `api_tokens` table (`user_id`, `token_hash`, `name`, `scopes`, `expires_at`, `last_used_at`, `revoked_at`) — store only the hash.
- Mint path: Server Action + "CLI Tokens" settings UI; show raw token **once**.
- `POST /api/notes`: Bearer token → hash → resolve user → write. Reuse note+cards creation.
- First **service-role** code path in the app (`SUPABASE_SERVICE_ROLE_KEY` already on Vercel prod/preview via marketplace; add to local `.env.local`). Confine it to ONE `src/lib/supabase/admin.ts` module.
- **Ownership wall moves from RLS to our code.** Funnel ALL writes through one `SECURITY DEFINER` RPC that derives `user_id` from the token itself — never accept `user_id` from the request body. This is the load-bearing ~15 lines; test exhaustively.
- Add rate limiting on the route; consider a session time-box.

**Phasing (intended):** Phase 1 = headless core (table + RPC + admin client + route + skill), tokens mintable via SQL/curl. Phase 2 (deferrable) = token-management UI.

Verify `api_tokens` + service-role insert patterns against current Supabase docs (Context7) at plan/implement time.
