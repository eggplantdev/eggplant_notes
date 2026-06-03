---
date: 2026-06-02T00:00:00+02:00
researcher: ex-Plant
git_commit: 791b3d395209e0c1e920fb7f1394d97b3f1b3ce6
branch: main
repository: coding-learning-companion
topic: 'F-02 internal evidence — how F-01 wired Supabase + the conventions F-02 persistence must reuse'
tags: [research, codebase, supabase, rls, migrations, feature-first, server-actions]
status: complete
last_updated: 2026-06-02
last_updated_by: ex-Plant
---

# Research: F-02 persistence-and-isolation — internal evidence

**Date**: 2026-06-02 (+02:00)
**Researcher**: ex-Plant
**Git Commit**: 791b3d3 (`main`)
**Repository**: coding-learning-companion

## Research Question

For F-02 (the repo's first DB migration: `notes` / `topic_checks` / `review_events` tables + RLS scoped by `auth.uid()` + minimal typed query helpers, verified by a two-account isolation test), what does the existing codebase already do? Specifically: how F-01 wired the Supabase clients, the typed-env pattern, the migration/config/tooling state, and the feature-first + Server-Action conventions the new code must follow.

## Summary

- **Two Supabase client factories, both untyped, anon-key only.** `src/lib/supabase/server.ts` (async, cookie-bound) is the single factory for Server Components, Server Actions, and Route Handlers; `src/lib/supabase/client.ts` is browser-only. Neither passes a `Database` generic — `.from('notes')` is currently `any`.
- **Isolation is RLS-by-design.** No `SUPABASE_SERVICE_ROLE_KEY` is read anywhere; the anon client carries the user's session cookie and `auth.uid()` in RLS policies is the only thing scoping rows. F-02 must preserve this — do **not** introduce a service-role bypass for app queries.
- **F-02 is genuinely first-of-kind on several axes:** first migration (`supabase/migrations/` does not exist), first generated `Database` type (none exists), first data-access layer (`queries.ts` — no `.from()` table read exists in the repo today), and first `revalidatePath`/`revalidateTag` (none exists; auth relies on `redirect` only).
- **Conventions to extend, not reinvent:** `ActionResultT` discriminated union, per-field + composed-object Zod schemas in `schemas.ts`, `validateInput`, the `runAuthAction` validate→client→call→normalize flow. But `runAuthAction` is hard-typed to Supabase's auth `{ error }` envelope and does **not** fit PostgREST `{ data, error }` — F-02 needs a table-aware sibling wrapper.
- **Tooling facts:** Supabase CLI `2.101.0` (mise, host-only); DB `major_version = 17`; local email confirmations OFF (test users instantly active); zero db/typegen npm scripts today.

## Detailed Findings

### Supabase client wiring (F-01)

- `src/lib/supabase/client.ts:1-8` — `createClient()` → `createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)`, synchronous, no cookie config. Used only in `'use client'` components.
- `src/lib/supabase/server.ts:1-25` — `async createClient()` → `createServerClient(...)` with `getAll`/`setAll` cookie bridge bound to `next/headers` `cookies()`. The `setAll` try/catch swallows the "can't set cookies from a Server Component" throw and relies on the proxy to refresh. **Single factory for all server contexts** (Server Components, Server Actions, Route Handlers).
- `src/proxy.ts:29-66` — builds its **own** `createServerClient` inline (needs `NextRequest`/`NextResponse` cookies, not `next/headers`). Canonical SSR cookie-sync: `request.cookies.getAll()` → re-create `NextResponse.next({ request })` → mirror cookies onto `response.cookies`. Refreshes session via `await supabase.auth.getUser()` immediately after creation (`proxy.ts:49-51`). Matcher intentionally includes `/api` (`proxy.ts:82`); signed-out-reachable `/api/*` routes must be added to `isPublic` (`proxy.ts:57-58`).
- `@supabase/ssr@^0.10.3` + `@supabase/supabase-js@^2.106.2`.

### Server Action call pattern (template for F-02)

- `src/features/auth/run-auth-action.ts:13-26` — `runAuthAction<T>(schema, input, call)`: validates with `validateInput`, creates the server client, runs `call(supabase, data)`, normalizes `{ error }` → `ActionResultT`. **Deliberately not** a Server Action / not `'use server'` (load-bearing comment, lines 9-12); redirects are the caller's job. The `call` callback return type is `Promise<{ error: { message: string } | null }>` (`run-auth-action.ts:16`) — fits `auth.*`, **not** PostgREST `{ data, error }`.
- `src/types/action.ts:2` — `export type ActionResultT = { success: true } | { success: false; error: string }`. The one shared type F-02 reuses verbatim.
- `src/features/auth/actions/sign-up.ts` (full) — `'use server'`, input `unknown`, return `Promise<ActionResultT>`, delegate to `runAuthAction`, `if (!result.success) return result`, then `redirect('/dashboard')`. The copy template.
- `src/features/auth/actions/sign-out.ts:7-11` — the no-validation variant: `await createClient()` → `supabase.auth.signOut()` → `redirect`, returns `Promise<void>`, wired as `action={signOut}` in `dashboard/page.tsx:16`.
- `src/features/auth/actions/reset-password.ts:11-18` — callback can be async and do extra work (read `headers()`, build redirect URL from `SITE_URL`) and return the result directly without redirect.
- `src/app/api/auth/confirm/route.ts:21` — Route Handler builds the client the **same way** as an action (`await createClient()`); validates `type` against `ALLOWED_OTP_TYPES` allow-list, `verifyOtp` in try/catch, `redirect()` kept outside the try.

### Validation pattern

- `src/features/auth/validate.ts:4-14` — `validateInput<T>(schema, data)` does `safeParse`, returns `{ success: true; data } | { success: false; error }`, flattening to the first issue message (`parsed.error.issues[0]?.message ?? 'Invalid input'`). Now a candidate for promotion to a shared location (2nd consumer triggers the rule).
- `src/features/auth/schemas.ts` — per-field schemas exported separately (`emailSchema`, `passwordSchema`, lines 6-8) for TanStack field `validators`; composed object schemas (`credentialsSchema`, lines 10-21) for server parse; co-located `z.infer` `*T` types (lines 23-25). One file feeds both form-field live validation and server-side object parse.

### Typed env + tooling state

- `src/lib/env.ts:9-23` — centralized Zod env: `NEXT_PUBLIC_SUPABASE_URL: z.url()`, `NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1)`, `NEXT_PUBLIC_SITE_URL: z.url().default('http://127.0.0.1:3000')`. Reads each `process.env.NEXT_PUBLIC_*` by **static key** (required for Next.js client inlining). Exports `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SITE_URL`. **`SUPABASE_SERVICE_ROLE_KEY` is read nowhere** — no service-role client exists.
- `.env.local` — exists; defines `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` only, pointed at `127.0.0.1` (local-stack keys). No service-role key, no `NEXT_PUBLIC_SITE_URL` (falls back to schema default).
- `supabase/config.toml` — `project_id = "10x_devs"`; `[db] port=54322, major_version=17`; `[db.migrations] enabled=true`; `[db.seed] enabled=true, sql_paths=["./seed.sql"]` (file absent); `[api] schemas=["public","graphql_public"]`; `[auth] site_url="http://127.0.0.1:3000", enable_signup=true, minimum_password_length=6`; **`[auth.email] enable_confirmations=false`** (local test users instantly active); Studio 54323, Inbucket 54324.
- `mise.toml` — `supabase = "2.101.0"` (host-only CLI), `node = "24"`, `pnpm = "11"`.
- `package.json` scripts — **zero** db/supabase/typegen scripts. Has `test:e2e` (`playwright test`), `typecheck`, `test` (vitest). All Supabase commands today are raw host `supabase ...` invocations.
- `supabase/migrations/` — **does not exist**. No `seed.sql`. No generated TS types (`database.types.ts` / `src/lib/supabase/types.ts` absent).
- `supabase/.gitignore` — ignores `.branches`, `.temp`, dotenvx env files; migrations + `seed.sql` are committed.

### Feature-first layout (where F-02 code lands)

- New domain code born in `src/features/<domain>/` owning `actions/`, `schemas.ts` (plural), `types.ts`, hooks. `src/lib/` is infra/util only — a domain-aware notes query helper goes in the **feature**, not `lib/`.
- `src/types/` holds cross-feature `*T` only, promoted on the **2nd** consumer (currently just `action.ts`).
- All mutations are Server Actions in `features/<domain>/actions/`, never `route.ts`. Route files stay thin; all `route.ts` under `src/app/api/`.
- `src/lib/utils/` has only `cn.ts` — nothing data-related to reuse.

## Code References

- `src/lib/supabase/server.ts:1-25` — async cookie-bound server client (the factory F-02 queries/actions call)
- `src/lib/supabase/client.ts:1-8` — browser client
- `src/proxy.ts:29-66,82,57-58` — SSR cookie sync + session refresh + `/api` matcher / `isPublic`
- `src/features/auth/run-auth-action.ts:9-26` — action wrapper (auth-`{error}`-shaped; not table-shaped)
- `src/types/action.ts:2` — `ActionResultT`
- `src/features/auth/actions/sign-up.ts` / `sign-out.ts:7-11` / `reset-password.ts:11-18` — action variants
- `src/features/auth/validate.ts:4-14` + `schemas.ts:6-25` — validation pattern
- `src/lib/env.ts:9-23` — typed env (no service-role key)
- `supabase/config.toml` — `major_version=17`, `enable_confirmations=false`, seed/migrations enabled
- `mise.toml` — `supabase = "2.101.0"`

## Architecture Insights

- **RLS is the isolation contract, not app code.** The PRD's #1 guardrail ("no user sees another's data even with an app-layer bug") is satisfied because the only client is anon-key + user session; there is no privileged path to bypass. Keep it that way — any service-role client is a new attack surface and must be justified, server-only, and never used for ordinary reads/writes.
- **`runAuthAction` does not generalize for free.** Its callback type models `{ error }` (auth). Table calls return `{ data, error }`. F-02 must either (a) generalize the wrapper to a discriminated `{ data, error }` shape, or (b) add a feature-local `run-*-action.ts` sibling. Forcing table calls through the auth wrapper will fight the types.
- **`ActionResultT` has no data-bearing success variant.** Reads that must return rows (e.g. `getNotes`) need either a separate query-helper path (recommended: `queries.ts` returning typed rows / throwing) or an extended result union. Mutations keep returning bare `ActionResultT`.
- **Typegen is a new convention to establish.** `supabase gen types typescript --local > src/lib/supabase/types.ts`, then thread `<Database>` into both factories. Consider adding `db:reset` / `db:types` package scripts for repeatability (net-new).

## Migration tooling facts for the plan

Run on the **host** (not devcontainer). Prereqs: `mise install` (provisions CLI 2.101.0) + `supabase start` (local stack; also required by E2E).

- Create first migration (creates the dir): `supabase migration new init_notes_topic_checks_review_events` → hand-write DDL + `enable row level security` + policies.
- Apply locally: `supabase db reset` (re-runs all migrations + loads `seed.sql` if present; both enabled in config). Use `supabase migration up` to apply pending without wiping.
- Regenerate types: `supabase gen types typescript --local > src/lib/supabase/types.ts`, then add `<Database>` generic to `server.ts` + `client.ts`.
- DB `major_version = 17` — any later hosted `db push` target must match.

## Historical Context (from prior changes)

- `context/archive/2026-06-02-minimal-auth-and-session/` — F-01: built the two client factories, `proxy.ts`, env module, auth actions, and the feature-first migration of auth code. Deliberately built against `auth.users` only; left the first table migration to F-02.
- `context/foundation/lessons.md` — two standing lessons apply to F-02 verification: (1) re-apply bootstrapper patches after `10x get`; (2) **verify against a server you confirmed bound, restart by PID/port not name** — directly relevant to the two-account E2E isolation test (a stale server produced a false conclusion during F-01).

## Recommended file layout (proposed for the plan, not prescriptive)

```
supabase/migrations/<timestamp>_init_notes_topic_checks_review_events.sql   # tables + RLS (auth.uid())
src/lib/supabase/types.ts                                                    # NEW generated Database type
src/features/notes/{actions/,queries.ts,schemas.ts,types.ts,run-note-action.ts?}
src/features/topic-checks/{actions/,queries.ts,schemas.ts,types.ts}
src/features/review-events/{actions/,queries.ts,schemas.ts,types.ts}
```

Feature dirs are kebab-case (`topic-checks`, `review-events`) even though tables are `topic_checks` / `review_events`. Whether the table-aware action wrapper is per-feature or a single promoted shared helper is a planning decision — default to writing it once and promoting on the 2nd consumer.

## Open Questions (for /10x-plan to resolve)

1. **Schema columns** (planner proposes): `notes` (markdown body, title?, timestamps, `user_id`), `topic_checks` (what a "topic check" row holds — prompt/question text, link to a note?, scheduling fields), `review_events` (FK to topic_check, `rating` **locked to SM-2 0–5 quality**, reviewed_at, computed interval/ease fields?). Where does SM-2 scheduling state live — on `topic_checks` or derived from `review_events`?
2. **Cascade + ownership**: every table carries `user_id uuid references auth.users default auth.uid()`? FK `on delete cascade` from `topic_checks`→`review_events` and note→topic_check?
3. **Typegen wiring** this change or deferred: thread `<Database>` into both factories now (small, high-value) vs leave untyped until a consumer slice.
4. **Two-account isolation test**: Playwright E2E (sign up acct A, create a note, sign out, sign up acct B, assert A's row invisible) vs a SQL/integration-level RLS test. E2E matches the existing harness but is heavier.
5. **Wrapper strategy**: generalize `runAuthAction` to `{ data, error }` vs feature-local sibling.

## External research (Context7 — `/supabase/supabase`, 2026-06-02)

The external leg of the m2l4 chain (exa.ai not wired; Context7 is the source). Live Supabase docs confirm the idioms F-02's migration should use.

### RLS policy syntax + per-user isolation

- **Enable then policy, per table:** `alter table <t> enable row level security;` then `create policy ... on <t> ...`. (Source: `guides/ai/rag-with-permissions.mdx`)
- **Scope to the `authenticated` role and `auth.uid()`.** Idiomatic per-action policies, e.g. select `using (... = user_id)`, insert `with check ((select auth.uid()) = user_id)`, delete `using ((select auth.uid()) = user_id)`. `WITH CHECK` guards writes (insert/update); `USING` guards reads/visibility (select/update/delete). (Sources: `row-level-security.mdx`, blog `cracking-postgres-interview`, `addTodos.sql` migration)
- A single `for all to authenticated using (user_id = auth.uid())` policy is valid and the simplest option, but separate per-action policies give explicit `with check` on writes — preferred for the isolation guardrail.

### RLS performance idioms (apply to all three tables)

- **Wrap `auth.uid()` in a subquery: `(select auth.uid()) = user_id`.** This triggers an `initPlan` so the optimizer caches the result instead of re-evaluating per row — only safe because the value doesn't vary by row. The official before/after example is exactly `auth.uid() = user_id` → `(select auth.uid()) = user_id`. (Source: `troubleshooting/rls-performance-and-best-practices`)
- **Index every `user_id` column used in a policy:** `create index <name> on <t> using btree (user_id);` — the #1 RLS perf recommendation for non-PK/non-unique policy columns. The plan must add a btree index on `user_id` for each of the three tables (and on FK columns like `topic_check_id`).

### Typegen + wiring the `Database` generic

- Exact command (matches CLI 2.101.0): `supabase gen types typescript --local > <path>` (equivalently `--lang=typescript --local`). Convention is `database.types.ts`; this repo's research recommends `src/lib/supabase/types.ts`.
- Wire it by importing the generated `Database` and passing it as the generic: `createClient<Database>(...)` — for this repo that means `createServerClient<Database>(...)` in `server.ts` and `createBrowserClient<Database>(...)` in `client.ts`. (Sources: `generating-types.mdx`, blog `local-first-expo-legend-state`)

### Implications for the plan

1. Use `(select auth.uid())` (not bare `auth.uid()`) in every policy — perf, and it's the documented best practice.
2. Add a btree index on `user_id` (and FK columns) in the same migration as the tables.
3. Write **separate per-action policies** (select/insert/update/delete) scoped `to authenticated`, with `with check` on the write policies — clearest enforcement of the #1 isolation guardrail.
4. Typegen command is settled: `supabase gen types typescript --local > src/lib/supabase/types.ts`, then thread `<Database>` into both factories.
