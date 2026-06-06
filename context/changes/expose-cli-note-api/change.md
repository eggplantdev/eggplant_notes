---
change_id: expose-cli-note-api
title: Expose a CLI/agent HTTP API to add notes + cards via personal API tokens
status: new
created: 2026-06-06
updated: 2026-06-06
archived_at: null
---

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
