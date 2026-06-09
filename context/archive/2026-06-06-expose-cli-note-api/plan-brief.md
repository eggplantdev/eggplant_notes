# CLI/agent HTTP API (notes + cards + reads) — Plan Brief

> Full plan: `context/changes/expose-cli-note-api/plan.md`

## What & Why

Let a CLI / agent read a user's structure and add notes + memory cards over HTTP, authenticated by a personal API token (GitHub-PAT model). The agent needs to **read** subjects/notes to decide _where_ new content goes, then **write** it — without ever holding the user's password or a god-key, and without weakening the database's ownership guarantees.

## Starting Point

All note/card creation is Server Actions using a cookie-based Supabase client; there is no HTTP API for app data, no `api_tokens` table, no service-role client, and no rate-limiting. The repo already keeps RLS as the ownership wall (`SECURITY INVOKER` RPC, `user_id default auth.uid()`).

## Desired End State

A token in `Authorization: Bearer` unlocks four endpoints — `GET /api/subjects`, `GET /api/notes`, `POST /api/notes` (note + optional cards), `POST /api/memory-cards` (attached or standalone). Every call runs as the token's user under RLS; a token can never touch another user's rows, and a `user_id` in a request body is ignored.

## Key Decisions Made

| Decision              | Choice                                                                     | Why                                                                      | Source            |
| --------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------- |
| Auth model            | Personal API tokens (hash-stored)                                          | Per-token revoke/expiry/audit; no password on disk                       | Frame (change.md) |
| Ownership enforcement | **Keep RLS** — mint a user JWT, reuse INVOKER path                         | DB stays the wall; bug = rejected write, not a breach                    | Plan              |
| Elevation             | **Drop service-role**; one `anon`-granted `SECURITY DEFINER` lookup        | Smallest blast radius; keeps repo's zero-service-role property           | Plan              |
| JWT minting           | `jose` HS256 via `SUPABASE_JWT_SECRET` (asymmetric = deploy-time key swap) | Both regimes accept hand-signed tokens; supabase-js `accessToken` option | Plan (Context7)   |
| Surface               | 4 endpoints (2 read, 2 write) on one auth pipeline                         | Agent must read structure to place content                               | Plan              |
| Card endpoint         | One `POST /api/memory-cards`, body discriminates note_id vs subject_id     | Covers both card modes without a 5th route                               | Plan              |
| Token shape           | `clc_`+32 random bytes, store SHA-256; `scopes` stored-not-enforced        | PAT ergonomics; schema ready for Phase 2                                 | Plan              |
| Rate limiting         | Deferred to Phase 2 (expiry + non-enumerable hash + Supabase limits)       | No infra for a headless, SQL-minted MVP surface                          | Plan              |
| Isolation test        | Vitest integration vs local Supabase, two real users                       | Only the real RLS+DEFINER+JWT path proves the guarantee                  | Plan              |

## Scope

**In scope:** `api_tokens` table + `resolve_api_token` DEFINER lookup; token helpers; JWT mint + JWT-scoped client; route auth pipeline; 4 endpoints; injectable insert cores; isolation test; SQL-mint docs.

**Out of scope:** token-management UI, scope enforcement, rate-limit infra, service-role, note-body reads, pagination, update/delete endpoints.

## Architecture / Approach

`Bearer token → sha256 → resolve_api_token (DEFINER, anon) → user_id → mint short-lived JWT (jose) → supabase-js { accessToken } → existing INVOKER RPC / RLS-scoped selects`. The security pipeline is built once (Phase 1) and gated by the isolation test; the four endpoints (Phase 2) are thin and reuse it. Write actions are refactored so their insert core accepts an injectable client — one source of truth shared by the cookie (UI) and JWT (API) paths.

## Phases at a Glance

| Phase               | Delivers                                                              | Key risk                                                |
| ------------------- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| 1. Auth core        | table + DEFINER lookup + token/JWT/client + pipeline + isolation test | Getting the JWT claims right so RLS accepts the token   |
| 2. Endpoints + docs | 4 routes, injectable cores wired, mint docs                           | Body-discriminated card route; keeping reads RLS-scoped |

**Prerequisites:** local Supabase up (`supabase start`); AI-integration branch landed (this is the last slice); confirm hosted JWT signing regime before prod.
**Estimated effort:** ~2 sessions (Phase 1 is the bulk; Phase 2 is thin).

## Open Risks & Assumptions

- Hosted (marketplace) Supabase signing regime unconfirmed — HS256 secret vs asymmetric key. Build/test on local HS256; verify + supply the matching key before prod. Not an architecture blocker.
- JWT claim set must be verified empirically against the local stack before being pinned (verify-against-reality).
- No rate limiting in Phase 1 — acceptable only because the surface is headless and SQL-minted; revisit before exposing widely.

## Success Criteria (Summary)

- A token writes notes/cards and reads subjects/notes that appear under the correct account.
- A second user's token sees and touches none of the first user's data; a body `user_id` is ignored; expired/revoked tokens 401.
- No service-role key anywhere in the app.
