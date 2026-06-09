# Implementation review — expose-cli-note-api

Date: 2026-06-09 · Scope: Phase 1 + 2 (both complete) · Run as part of `/slice-review-gate`.
Diff: `13cef6b..HEAD`. Verdict: **APPROVED** (with F1 fixed during the gate).

## Verdict by dimension

| Dimension           | Result                                              |
| ------------------- | --------------------------------------------------- |
| Plan adherence      | PASS                                                |
| Scope discipline    | PASS                                                |
| Safety & quality    | PASS                                                |
| Architecture        | PASS                                                |
| Pattern consistency | PASS                                                |
| Success criteria    | PASS (F2's planned unit test added during the gate) |

## Security verdict (the focus — auth surface)

Sound. Verified:

- **Single elevated surface** — `resolve_api_token` (SECURITY DEFINER, `search_path=''`, granted to `anon`); nothing else elevated. No service-role key anywhere in the app.
- **Token stored hash-only** (SHA-256); the raw token never reaches SQL beyond its hash. No raw token / hash in any log line.
- **Short-lived minted JWT** (120s, `jose` HS256, lazy secret read mirroring `aes-gcm.ts`); RLS under that JWT is the ownership wall — the routes reuse existing INVOKER cores/RPCs.
- **Proven by 11/11 integration** (pre-gate): cross-tenant read isolation, spoofed body `user_id` ignored, expired → 401, revoked → 401, missing/garbage → 401.

## Findings

- **F1 (WARNING) — FIXED in the gate.** `memory-cards` body `z.union` fall-through silently re-routed a note-attach body with a malformed `cards` array to the standalone-card branch (201 instead of 400). Fix: route now selects the schema by raw `note_id` presence and validates against that one branch; dead union + type removed. Commit `3a3d876`.
- **F2 (WARNING) — ADDRESSED in the gate.** Plan's discriminated-body unit test was missing. Added `src/__tests__/api-card-body.test.ts` (8 specs) + a route-level integration regression guard. Commit `3a3d876`.
- **F3 (OBSERVATION) — dismissed.** `SUPABASE_JWT_SECRET` read lazily in `mint-user-jwt.ts`, not confined to `env.ts`. Justified deviation — mirrors the `aes-gcm.ts` `OPENROUTER_ENC_KEY` precedent; `env.ts` is NEXT_PUBLIC-only by design. No action.
- **F4 (OBSERVATION) — dismissed.** Fresh supabase-js client per request in `from-access-token.ts`. Correct — the `accessToken`-per-client model requires it; construction is cheap. No action.

## Suite at gate close

Fast legs green: typecheck, eslint, 186 unit (+8 new), build. `test:integration` deferred (no local stack this session) — re-run before merge to confirm the new route-level F1 guard + that the `getSubjects` reuse didn't perturb `/api/subjects` output (ordering-only, low risk).
