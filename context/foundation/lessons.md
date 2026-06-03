# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Re-apply /10x-bootstrapper patches after every `10x get`

- **Context**: Any time a Module-1 lesson is re-fetched via `10x get` (m1l3/m1l4/m1l5…). The `.claude/skills/10x-bootstrapper/` files are vendored and overwritten with upstream's shipped versions on every fetch.
- **Problem**: Upstream still ships two bugs this repo patched — `audit_commands.js` as a bare `npm audit` string (fails `ENOLOCK` on pnpm) and a `.bootstrap-scaffold` temp-dir name (`create-next-app` rejects dot-prefixed names). A fetch silently reverts both, so a later `/10x-bootstrapper` run would break on this pnpm project.
- **Rule**: After any `10x get`, run `git checkout HEAD -- .claude/skills/10x-bootstrapper/` to re-apply the committed patches, then confirm `git status` shows those files unmodified.
- **Applies to**: all

## Verify against a server you confirmed bound — not a stale one

- **Context**: Manual/Playwright verification of a Next.js app via a local server. `next start` renames its process to `next-server`, so `pkill -f "next start"` never matches it; the old server keeps holding port 3000 and every "restart" silently fails with `EADDRINUSE`.
- **Problem**: The browser then hits the **stale build**, so code changes appear to have no effect. During F-01 this produced a confident-but-false conclusion ("Zod Standard-Schema validators don't populate field errors") and a needless workaround + wrong comment — all because three "fixes" were tested against an unchanged server. A wrong test is worse than no test: it manufactures false certainty.
- **Rule**: Restart by PID/port, not name: `kill $(lsof -i :3000 -sTCP:LISTEN -t)`. Before trusting any test, confirm the **new** server bound (check the start log for `Ready` AND that the listening PID changed / no `EADDRINUSE`). When a fix "has no effect," suspect the harness before re-diagnosing the code.
- **Applies to**: /10x-implement, /10x-impl-review, any manual/E2E verification

## In Playwright, authenticate a supabase-js client with `signInWithPassword`, not browser-cookie reuse

- **Context**: Any E2E test that needs an **authenticated API client** (not just UI clicks) — e.g. seeding rows or asserting RLS isolation directly against PostgREST, where no mutation UI exists yet.
- **Problem**: Two traps that make the obvious approach fail. (1) `@supabase/ssr` stores the session as **HttpOnly, base64-chunked `sb-*-auth-token` cookies** — there is no JS-accessible token in the browser to "reuse from the signed-in context," so scraping `page.context().cookies()` is fiddly and coupled to ssr's encoding. (2) The Playwright **spec process loads no env** — `playwright.config.ts` only reads `process.env.CI`; the webServer gets `.env.local` because Next loads it natively, but a raw spec does not, and `@/lib/env` is a Next path alias unreachable from the test runner. So `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` is undefined in the spec.
- **Rule**: Build the per-account client with `createClient(url, anonKey)` + `signInWithPassword(email, password)` using the test's own known credentials — it returns the `access_token` directly, no cookie extraction. Make the URL + anon key reachable to the spec by loading `.env.local` in `playwright.config.ts` (add `dotenv`, or inline the deterministic local anon key). Drive sign-up through the real UI for the auth-path coverage, but do **data ops** through the programmatic client.
- **Corollary**: Repo read helpers call `createClient()` (server, `next/headers` cookies) which throws outside a request — so any helper a test must call has to accept an **injectable** `SupabaseClient` (defaulting to `createClient()` in app code).
- **Applies to**: /10x-plan, /10x-implement, any Playwright E2E needing authenticated API access

## Verify Postgres constraints/schema via pg_catalog, not information_schema

- **Context**: Any time you probe Postgres schema during implement/review/research — confirming a FK's `ON DELETE` action, checking RLS policies, grants, or column definitions (e.g. proving `auth.sessions → auth.users` cascades before relying on it).
- **Problem**: `information_schema`'s multi-view FK joins give false negatives for cross-schema FKs and only surface objects the current role has column privileges on. A constraint query returned **0 rows** for the real `auth.sessions → auth.users ON DELETE CASCADE` that `pg_constraint` then confirmed — trusting it would have manufactured false certainty ("no cascade exists") and could have reverted a correct decision.
- **Rule**: When verifying constraints/FKs/schema, query the `pg_*` catalog (`pg_constraint`, `pg_class`, `pg_policy`, `pg_proc`) as the authoritative source — not `information_schema`. Treat an `information_schema` "absence" as unproven, not confirmed. (Same family as the verify-against-reality / pick-the-authoritative-probe rule.)
- **Applies to**: /10x-implement, /10x-impl-review, /10x-research, /10x-plan-review

## Local-Supabase E2E sign-up is intermittently flaky (GoTrue DB race) — don't gate on it

- **Context**: Running the Playwright suite (`pnpm test:e2e`) against the local Supabase stack. Every spec signs up a fresh user through the UI via the shared `e2e/helpers.ts` `signUp`.
- **Problem**: Single GoTrue container under sustained load over a long serial run. Two faces of the same cause: (1) sign-up intermittently fails to reach `/dashboard` and stays on `/sign-up` with an empty error alert ("Database error finding/saving user"); (2) a _later_ nav (e.g. `createNote` → `toHaveURL(/notes/[id])`) times out because `proxy.ts` revalidates the session via GoTrue `GET /auth/v1/user` on every protected navigation, and those calls slow as the run accumulates (observed `/user` durations climbing 38→128ms). Not app code — it clears after a container restart. Red herrings: `[auth.rate_limit] email_sent` ("requires auth.email.smtp"; local uses Mailpit + `enable_confirmations = false` → sign-up sends no email); `sign_in_sign_ups = 30/5min` is a real ceiling back-to-back reruns _can_ breach, but a 429 fails the sign-up POST (stuck-on-/sign-up), not a later nav.
- **Rule**: Environmental flake, don't gate on it. **Fixed permanently via `retries: 2` in `playwright.config.ts`** — `uniqueEmail()` is called inside each test body, so a retry reruns from the top with a brand-new account, side-stepping the race; `trace: 'on-first-retry'` still captures a real regression. Plus read-only specs (`dashboard.spec.ts`) reuse one shared session (a `setup` project saves `storageState`) to cut sign-up load — but mutation / empty-state / isolation specs **must** keep fresh-per-test sign-ups (they assert clean-slate / exact counts / distinct users; sharing a session swaps the flake for a contamination bug). For a stubborn local DB: `supabase db reset` (restarts containers → clears GoTrue state).
- **Applies to**: /10x-implement, /10x-impl-review, any Playwright E2E on the local stack

## E2E must build a FRESH server — `reuseExistingServer: true` hijacks a running `next dev`

- **Context**: `pnpm test:e2e` while a `next dev` server is up on port 3000 (the normal case when developing one slice and testing another, or two parallel sessions). `playwright.config.ts` had `reuseExistingServer: !process.env.CI` (= `true` locally) with the webServer on the **same port 3000**.
- **Problem**: Playwright saw a server already on 3000 and **silently reused the `next dev` server** instead of running `pnpm build && pnpm start`. `next dev --turbo`'s on-demand compile + Fast Refresh is exactly the hydration race the prod-build was chosen to avoid: the sign-up form submits as a **native GET** (`/sign-up?email=…&password=…` in the URL) before React attaches its `onSubmit`, so it never POSTs to the Server Action → **every sign-up-dependent spec fails deterministically** (~14/15). Misleading because it looks identical to the GoTrue flake above but is 100% reproducible, and a `supabase db reset` is a **red herring** (correlates only because a dev server happened to come up around the same time). Confirm the DB is innocent in one shot: `curl -X POST $URL/auth/v1/signup …` returns a token → the break is frontend, not the DB.
- **Rule**: E2E **always builds and tests a fresh production server, never a reused one** — `reuseExistingServer: false`. To let it coexist with a running `next dev`, isolate the e2e server on **both** axes: a dedicated **port (3100)** and a separate build dir (**`NEXT_DIST_DIR=.next-e2e`**, read by `next.config.ts`) so the e2e `next build` doesn't hit the dev server's `.next` build-lock ("Another next build process is already running"). Never flip `reuseExistingServer` back to `true` for speed — that is the bug. Diagnose a suspected hijack with `lsof -i :3000` + walking the parent chain to see `next dev` vs `next start`.
- **Applies to**: /10x-implement, /10x-impl-review, any Playwright E2E run while a dev server may be up
