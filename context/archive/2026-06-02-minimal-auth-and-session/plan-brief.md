# Minimal Auth and Session — Plan Brief

> Full plan: `context/changes/minimal-auth-and-session/plan.md`

## What & Why

Build F-01: email/password auth (sign-up, sign-in, sign-out, password reset) with an SSR session via `@supabase/ssr`, and gate product routes so unauthenticated requests redirect to sign-in. Every downstream slice (S-01…S-05) scopes data by the authenticated user, so this unblocks the whole roadmap — and broken auth blocks all value (PRD guardrail).

## Starting Point

Deps are installed (`@supabase/ssr`, `supabase-js`, Supabase CLI) and `supabase/config.toml` exists, but there is zero auth code: no clients, no proxy/middleware, no auth routes, no `.env.local`, and the local stack isn't running. Local config already matches the PRD (`enable_confirmations = false`, 6-char min password).

## Desired End State

A user is redirected to `/sign-in`, signs up, lands on a gated stub page, can sign out / back in, and can reset a password end-to-end (email in local Inbucket → link → set new password). Gating holds in two places (proxy + protected layout). All flows pass Playwright E2E against the local stack.

## Key Decisions Made

| Decision           | Choice                                                                  | Why                                                                                                         | Source      |
| ------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------- |
| Scope = F-01 only  | Auth + session + gating                                                 | Highest fan-out foundation; unlocks all slices                                                              | Roadmap     |
| Email verification | Not gated                                                               | FR-002 defers gate to v1.1                                                                                  | PRD         |
| Submit path        | Server Actions                                                          | Official Supabase SSR pattern; cookies set server-side                                                      | Plan        |
| Gating             | Proxy + layout (defense-in-depth)                                       | Proxy already runs for refresh; layout is authoritative backstop                                            | Plan        |
| Password reset     | Full (request + update)                                                 | FR-004 only met end-to-end with both halves                                                                 | Plan        |
| UI fidelity        | shadcn forms, minimal                                                   | Theme set (neutral/grayscale, light+dark); components not yet generated — add in Phase 3; speed over polish | Plan        |
| Forms              | TanStack Form (`useAppForm`) mirrored from wykonczymy, pinned `^1.27.7` | User directive; reference pattern composes with Server Actions                                              | User        |
| Proxy file         | `src/proxy.ts` (not `middleware.ts`)                                    | Next.js 16 deprecation, verified via Context7; runtime nodejs                                               | User + Docs |
| Testing            | Playwright E2E harness                                                  | User directive (overrode lighter rec)                                                                       | User        |

## Scope

**In scope:** SSR clients, `proxy.ts` session refresh + gating, `/api/auth/confirm` token exchange, 4 auth pages via TanStack Form + Server Actions, `(protected)` layout guard + stub page, local stack + `.env.local`, Playwright auth E2E.

**Out of scope:** app-table migrations (F-02), account deletion (S-05), email-verification gate, OAuth/MFA/magic-link, external-LLM connect, real dashboard (S-04), full wykonczymy field-component set.

## Architecture / Approach

Browser client (client components) + per-request server client (`await cookies()`, Next 16 async). `src/proxy.ts` refreshes the session cookie every request and does optimistic gating; the `(protected)` layout re-checks `getUser()` authoritatively. Auth forms are client components on a mirrored `useAppForm`; submit calls a `'use server'` action that sets cookies via the server client and `redirect()`s. Password recovery flows through `/api/auth/confirm` (`verifyOtp`) → `/update-password`.

## Phases at a Glance

| Phase                  | What it delivers                                    | Key risk                                 |
| ---------------------- | --------------------------------------------------- | ---------------------------------------- |
| 1. Local stack + env   | Running Supabase + `.env.local`                     | Docker not running                       |
| 2. SSR clients + proxy | Clients + `proxy.ts` refresh + confirm route        | Next 16 proxy + async cookie ordering    |
| 3. Forms + actions     | TanStack Form infra + 4 auth pages + Server Actions | Recovery-link → update-password flow     |
| 4. Gating + shell      | Proxy redirect + protected layout + stub            | Matcher gaps (mitigated by layout guard) |
| 5. Playwright E2E      | Automated auth-flow regression                      | Reset/email step flakiness               |

**Prerequisites:** Docker for local Supabase; `mise install` (provisions the Supabase CLI — now a mise tool, not an npm dep); `node_modules` installed (`pnpm install` — the local tree was incomplete).
**Estimated effort:** ~3–4 after-hours sessions across 5 phases.

## Open Risks & Assumptions

- Next.js 16 `proxy.ts` runtime is `nodejs` only — fine for Supabase, but no edge.
- `@supabase/ssr` 0.10.x is pre-1.0; the `getAll`/`setAll` cookie contract was verified, but minor API drift is possible — re-check against docs if errors surface.
- Playwright reset test depends on reading mail from Inbucket's API; if the local mail backend is mailpit instead, the fetch shape differs.

## Success Criteria (Summary)

- A user completes sign-up → sign-in → reset → sign-out without errors against the local stack.
- Unauthenticated access to gated routes always redirects to `/sign-in`.
- Playwright auth E2E suite is green across two consecutive runs.
