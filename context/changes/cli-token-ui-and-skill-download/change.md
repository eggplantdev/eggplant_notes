---
change_id: cli-token-ui-and-skill-download
title: Settings CLI token management UI + downloadable agent skill
status: implementing
created: 2026-06-09
updated: 2026-06-09
archived_at: null
---

## Notes

Settings page to mint/name/revoke personal API tokens (clc\_ tokens, show raw once) plus a "Download agent skill" action that serves the clc-note-api SKILL.md with the app's production origin injected as BASE. Completes Phase 2 of the parked expose-cli-note-api work; makes the downloadable agent skill actually usable by real users (no SQL, no localhost). Artifact: the verified clc-note-api skill md stashed in this change folder.

## Implementation addenda (beyond the written plan)

Phase 2 grew three changes the plan text did not list — surfaced + accepted during the slice review gate:

1. **Copy-skill button** alongside Download — origin injected server-side and copied synchronously in the click gesture (Safari clipboard-safe). Shares `fillSkillTemplate` + `originFromHeaders` with the download route.
2. **Proxy `/api/*` gate fix** (`src/proxy.ts`) — `/api/*` was 307→`/sign-in` before any handler ran, so the Bearer-token API (and the merged Phase-1 work) was unreachable. Now all `/api/*` bypass the HTML redirect and self-enforce auth in-handler. Paired with an explicit `getCurrentUser` guard restored to `/api/openrouter/callback` (it had relied on the proxy backstop). Regression test: `proxy-api-gate.test.ts`.
3. **`SUPABASE_JWT_SECRET` env validation + 500-hardening** — added to `serverSchema` (build/dev-start fails fast if missing) and `authenticateRequest` now returns a structured JSON 500 instead of an uncaught throw (was a bodyless 500). Tests: `env-schema.test.ts`, `authenticate-request.test.ts`.
