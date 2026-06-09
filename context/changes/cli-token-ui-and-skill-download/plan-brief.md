# CLI Token Management UI + Downloadable Agent Skill — Plan Brief

> Full plan: `context/changes/cli-token-ui-and-skill-download/plan.md`
> Research: `context/changes/cli-token-ui-and-skill-download/research.md`

## What & Why

Phase 2 of `expose-cli-note-api`: a **Settings → CLI Tokens** UI to mint/copy-once/list/revoke personal API tokens, plus a **session-gated "Download agent skill"** that serves the `clc-note-api` skill with the deployment origin injected. Without this, the merged HTTP API is unusable by anyone but the owner (tokens were SQL-only).

## Starting Point

The auth + data backend is merged: `api_tokens` table with `select/insert/update_own` RLS, `resolve_api_token`, and `generateToken()`. There is no UI, no mint/revoke Server Actions, and no way for a non-owner to get a token. The skill artifact already exists in the change folder with a `{{CLC_BASE_URL}}` placeholder.

## Desired End State

A logged-in user mints a named token in Settings, sees the raw value once (with Copy), downloads the agent skill (now carrying the production URL), and pastes the token in. They can list active tokens (name / created / last-used) and revoke any; a revoked token immediately 401s against `/api/*`.

## Key Decisions Made

| Decision            | Choice                             | Why                                                          | Source   |
| ------------------- | ---------------------------------- | ------------------------------------------------------------ | -------- |
| Mint elevation      | Direct insert under session client | `api_tokens_insert_own` RLS exists — no service-role/DEFINER | Research |
| Revoke              | `update revoked_at` (soft)         | No delete policy; preserve audit row                         | Research |
| Mint return type    | Widen to `{ success, rawToken }`   | `ActionResultT` carries no payload; secret shown once        | Research |
| Download route auth | Session-gated                      | Consistent with a Settings feature; trivial guard            | Plan     |
| Token expiry        | None in v1 (revoke is control)     | Simplest; matches GitHub PAT default                         | Plan     |
| Revoked tokens      | Hidden from list                   | Clean list; row persists as audit                            | Plan     |
| Template storage    | Bundled TS string constant         | Vercel-bundle-safe vs `fs.readFile` of a non-traced `.md`    | Plan     |

## Scope

**In scope:** mint (named, copy-once modal), list (active only), revoke (soft, confirmed); a TS-constant skill template; a session-gated `GET /api/skill` injecting the origin; a download button.

**Out of scope:** expiry UI, scope picker, device/OAuth auto-issuance, rate limiting, revoked-token display, token rotation, any new migration.

## Architecture / Approach

Server actions (`mint-api-token`, `revoke-api-token`) + query (`getApiTokens`) under `src/features/api-tokens/`, all on the cookie-session RLS client. UI: a new `<SettingsSection>` with a `useAppForm` mint form, a from-scratch show-once + clipboard `Dialog`, and an active-tokens list with per-row `useActionTransition` revoke. The download route reads a bundled TS template constant, injects the origin via the existing `connect.ts` host-header pattern, and returns it as a `Content-Disposition: attachment` markdown response.

## Phases at a Glance

| Phase                 | What it delivers                                         | Key risk                                                           |
| --------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| 1. CLI Tokens section | mint → copy-once → list → revoke, end to end             | The reveal modal + clipboard are net-new (no precedent)            |
| 2. Downloadable skill | session-gated `/api/skill` with origin injected + button | Template-constant drifting from the `.md` (guarded by a unit test) |

**Prerequisites:** isolated branch/worktree off `main` (currently sitting on a parallel session's branch); the merged Phase-1 backend. **Estimated effort:** ~1–2 sessions across 2 phases.

## Open Risks & Assumptions

- **Branch hygiene:** plan/research ran on `feat/new-user-welcome-dialog` (a parallel session's branch). Implement on a dedicated worktree off `main`.
- The servable TS constant and the human-readable `.md` are two copies — a unit test pins the placeholder + endpoints to fail on drift.
- Hosted `/api/*` still needs `SUPABASE_JWT_SECRET` set on Vercel (Phase-1 concern, independent of this UI) before the downloaded skill works against prod.

## Success Criteria (Summary)

- A non-owner user can self-serve: mint a token in Settings, copy it once, download the skill, and create notes/cards against the deployment.
- Revoke is immediate (revoked token 401s); a second account sees none of the first's tokens.
- The downloaded skill's `BASE=` equals the deployment origin; `/api/skill` rejects the unauthenticated.
