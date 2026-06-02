# Minimal Auth and Session — Implementation Plan

## Overview

Stand up the F-01 foundation: email/password sign-up, sign-in, sign-out, and password reset, with a server-side session established via `@supabase/ssr`. Product routes are gated — unauthenticated requests redirect to sign-in. This unlocks every downstream slice (S-01…S-05), which all scope data by the authenticated user. Built and verified against a local Supabase stack, with auth flows covered by Playwright E2E.

## Current State Analysis

- **Deps present, code absent:** `@supabase/ssr@^0.10.3` + `@supabase/supabase-js@^2.106.2` + `supabase` CLI `^2.101.0` are installed; `supabase/config.toml` exists. There is **no** auth code: no `src/lib/supabase/*`, no proxy/middleware, no auth routes, no `.env.local`, and the local stack is not running.
- **Local auth config already aligns with the PRD:** `supabase/config.toml` has `enable_confirmations = false` (FR-002 — no verification gate in v1), `site_url = http://127.0.0.1:3000`, `minimum_password_length = 6`. No config change needed.
- **Next.js 16 changes the proxy/middleware contract:** `middleware.ts` is **deprecated** — renamed to `proxy.ts` with an exported `proxy` function; runtime is `nodejs` only (no edge). Verified against live Next.js 16 upgrade docs. The Supabase session-refresh cookie logic is unchanged; only the filename + export name differ.
- **Reference form pattern exists:** `wykonczymy` wires TanStack Form via `createFormHook` + `createFormHookContexts` → a `useAppForm` with bound field components (`src/components/forms/hooks/form-hooks.ts`), and a `useFormSubmit` hook whose `action: () => Promise<ActionResultT>` calls a Server Action. We mirror this pattern (not its full component set).
- **shadcn theme established, components NOT generated:** `components.json` (`style: radix-nova`, `baseColor: neutral`) + full token set in `globals.css` (`:root` + `.dark`, monochrome/grayscale palette, red `--destructive` the only hue). But `src/components/ui/` holds only `.gitkeep` — **no components exist yet**. `Button`, `Input`, `Card`, `Label` must all be added via `pnpm dlx shadcn@latest add` in Phase 3.

## Desired End State

A new user can: open the app → be redirected to `/sign-in` → sign up → land on a gated stub page → sign out → sign back in → request a password reset (email visible in local Inbucket/mailpit) → follow the link → set a new password → sign in with it. Unauthenticated hits to gated routes always redirect to `/sign-in`; signed-in users hitting auth pages redirect to the gated area. All flows pass automated Playwright E2E against the local stack.

### Key Discoveries:

- Next.js 16: `src/proxy.ts` with `export function proxy()` replaces `middleware.ts` (`node_modules/next` docs confirmed via Context7; runtime `nodejs`).
- `@supabase/ssr` 0.10.x uses the `cookies: { getAll, setAll }` contract with Next 16's **async** `cookies()` — `await cookies()` in the server client.
- TanStack Form → Server Action composition is the reference-verified shape (`wykonczymy/src/components/forms/hooks/use-form-submit.ts`).
- Password recovery needs a token-exchange route (`/auth/confirm`) that `verifyOtp`s the `token_hash` and redirects to the update-password page with an active session.

## What We're NOT Doing

- **No app-table migrations** (`notes`/`topic_checks`/`review_events`) — that is F-02 `persistence-and-isolation`. F-01 builds against Supabase's built-in `auth.users` only.
- **No account deletion** — that is S-05 `delete-account-and-data`.
- **No email-verification gate** — FR-002 defers it to v1.1 (`enable_confirmations = false` stands).
- **No OAuth / social / magic-link / MFA** — email+password only for v1.
- **No external-LLM "Connect" or programmatic token surface** — v1.1.
- **No product UI** beyond a minimal stub gated page to prove the redirect; real dashboard is S-04.
- **No full wykonczymy field-component set** — only the field component(s) the auth forms need (text/email/password input).

## Implementation Approach

Follow the official Supabase Next.js App Router SSR pattern, adapted for Next.js 16's `proxy.ts`. Two Supabase clients (browser + server) plus a proxy that refreshes the session cookie on every request and performs an optimistic gating redirect. Auth forms are client components built on a mirrored TanStack Form `useAppForm`; submission calls Server Actions that use the server client to set session cookies and `redirect()` on success. Gating is defense-in-depth: optimistic check in `proxy.ts` (free, since the proxy already runs for refresh) plus an authoritative `getUser()` re-check in the `(protected)` layout.

## Critical Implementation Details

- **Timing & lifecycle (proxy):** In `proxy.ts`, you must create the response, create the server client wired to read request cookies and write to _both_ request and response, then call `supabase.auth.getUser()` (or `getClaims()`) — **do not run any code between client creation and the `getUser()` call**, and always return the response object whose cookies were mutated. Reordering breaks silent session refresh and causes random logouts. This is the one non-obvious snippet below.
- **State sequencing (auth callback):** the password-reset email link hits `/auth/confirm?token_hash=…&type=recovery`; the route must `verifyOtp` first (which establishes the session) before redirecting to `/update-password`. The update-password page then calls `updateUser({ password })` against the now-active session.

## Phase 1: Local Supabase stack + env

### Overview

Bring the local Supabase stack online and write `.env.local` so the app can talk to it during dev. Prerequisite for everything else.

### Changes Required:

#### 1. Start the local stack

**File**: (no file) — run `supabase start` (Docker required; the CLI is provisioned by `mise install`, not pnpm).

**Intent**: Boot local Postgres + Auth (GoTrue) + Studio + Inbucket so auth flows run without hosted creds.

**Contract**: Command prints local `API URL` (`http://127.0.0.1:54321`), `anon key`, `service_role key`, `Studio URL`, and `Inbucket URL`. Capture the API URL + anon key for the next step.

#### 2. Local env file

**File**: `.env.local`

**Intent**: Provide the browser + server clients the local Supabase URL and anon key. Gitignored already (`supabase/.gitignore` covers `.env*.local`).

**Contract**: Two vars — `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key>`. Local keys only — never the hosted prod/preview creds (per AGENTS.md).

### Success Criteria:

#### Automated Verification:

- Stack reports healthy: `supabase status` lists running services.
- `.env.local` exists and contains both `NEXT_PUBLIC_SUPABASE_*` vars.

#### Manual Verification:

- Studio loads at the printed URL.
- Inbucket/mailpit loads (it will receive the reset emails in Phase 3/5).

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: SSR clients + proxy session refresh

### Overview

Create the browser and server Supabase clients and the Next.js 16 `proxy.ts` that refreshes the session cookie on every request. Add the `/auth/confirm` token-exchange route used by reset (and future email) links.

### Changes Required:

#### 1. Browser client

**File**: `src/lib/supabase/client.ts`

**Intent**: Singleton-style browser client for use in client components.

**Contract**: Exports `createClient()` returning `createBrowserClient(url, anonKey)` from `@supabase/ssr`, reading the two `NEXT_PUBLIC_SUPABASE_*` env vars.

#### 2. Server client

**File**: `src/lib/supabase/server.ts`

**Intent**: Per-request server client for Server Components, Server Actions, and route handlers.

**Contract**: Exports an `async createClient()` that calls `await cookies()` (Next 16 async API) and passes `cookies: { getAll, setAll }` to `createServerClient`. `setAll` wraps cookie writes in try/catch (Server Component render context cannot set cookies — the proxy handles refresh there).

#### 3. Proxy (session refresh)

**File**: `src/proxy.ts`

**Intent**: Refresh the session cookie on every matched request (Next.js 16 replacement for `middleware.ts`). Gating logic is added in Phase 4; this phase establishes refresh + structure.

**Contract**: `export async function proxy(request: NextRequest)` plus `export const config = { matcher: [...] }` excluding static assets. Runtime is `nodejs` (proxy default; not configurable). Non-obvious cookie + ordering contract:

```ts
// src/proxy.ts
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(URL, ANON, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })
  // IMPORTANT: nothing between client creation and getUser()
  await supabase.auth.getUser()
  return response // (Phase 4 inserts redirect logic before this return)
}
```

#### 4. Auth confirm route

**File**: `src/app/auth/confirm/route.ts`

**Intent**: Handle email-link callbacks (password recovery now; email confirm later) by exchanging the token for a session.

**Contract**: `GET` reads `token_hash` + `type` from query, calls `supabase.auth.verifyOtp({ type, token_hash })`, then `redirect()`s to `/update-password` (recovery) or `/` on success, `/sign-in?error=…` on failure.

### Success Criteria:

#### Automated Verification:

- Type check passes: `pnpm exec tsc --noEmit` (or project typecheck script).
- Lint passes: `pnpm lint`.
- Build compiles `proxy.ts`: `pnpm build` succeeds (no middleware/proxy errors).

#### Manual Verification:

- With the dev server running, loading any page sets/refreshes a Supabase auth cookie (visible in devtools) without error.

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: TanStack Form infra + auth pages + Server Actions

### Overview

Add TanStack Form, build the `useAppForm` infra mirrored from wykonczymy, and implement the four auth pages (sign-in, sign-up, reset-request, update-password) wired to Server Actions.

### Changes Required:

#### 1. Dependency

**File**: `package.json`

**Intent**: Add TanStack Form pinned to the reference repo's version.

**Contract**: `@tanstack/react-form` at `^1.27.7` (mirror wykonczymy). Install via `pnpm add`. Generate the shadcn components the auth forms need — none exist yet (`src/components/ui/` is empty): `pnpm dlx shadcn@latest add button input label card`. Theme tokens are already in `globals.css` (neutral/grayscale), so generated components pick up the palette automatically.

#### 2. Form hook infra

**File**: `src/components/forms/hooks/form-hooks.ts`

**Intent**: Create the bound `useAppForm` with field components, mirroring `wykonczymy/src/components/forms/hooks/form-hooks.ts`.

**Contract**: `createFormHookContexts()` → contexts; `createFormHook({ fieldComponents: { Input: FormInput }, formComponents: {}, fieldContext, formContext })` → exports `useAppForm`. Keep `fieldComponents` minimal (text/email/password input) for F-01.

#### 3. Field component(s)

**File**: `src/components/forms/form-components/form-input.tsx`

**Intent**: A field-context-aware input over the shadcn `Input` + `Label`, showing validation errors.

**Contract**: Uses `useFieldContext()`; renders label, shadcn `Input`, and field error messages from `field.state.meta`. Mirror the shape of wykonczymy's field components.

#### 4. Server Actions

**File**: `src/features/auth/actions/{sign-up,sign-in,sign-out,reset-password,update-password}.ts` (one file per action; domain code lives under `features/`, not `app/` or `lib/`). Validation schemas in `src/features/auth/schemas.ts`; shared result type in `src/types/action.ts`.

**Intent**: Server-side handlers for sign-up, sign-in, sign-out, reset-request, update-password using the server client.

**Contract**: `'use server'` functions returning a typed result `{ success: boolean; error?: string }` (the `ActionResultT` in `src/types/action.ts`, mirroring wykonczymy's shape) so forms render inline errors; on success they `redirect()`. `signUp`/`signIn` → `supabase.auth.signUp`/`signInWithPassword`; `signOut` → `supabase.auth.signOut`; `resetPassword` → `resetPasswordForEmail(email, { redirectTo: <site>/auth/confirm?... })`; `updatePassword` → `supabase.auth.updateUser({ password })`.

#### 5. Auth pages (route group)

**File**: `src/app/(auth-pages)/sign-in/page.tsx`, `sign-up/page.tsx`, `reset-password/page.tsx`, `update-password/page.tsx`

**Intent**: Client-component forms built on `useAppForm`, submitting to the matching Server Action.

**Contract**: Each page renders a `useAppForm` form with the fields it needs and an `onSubmit` that calls its Server Action; displays returned error. shadcn `Card` wrapper, minimal styling. `(auth-pages)` route group keeps them outside the gated tree.

### Success Criteria:

#### Automated Verification:

- Type check passes: `pnpm exec tsc --noEmit`.
- Lint passes: `pnpm lint`.
- Build succeeds: `pnpm build`.
- Unit test for the Server Action result/validation helper passes: `pnpm test`.

#### Manual Verification:

- Sign-up creates a user (visible in Studio → Auth) and establishes a session.
- Sign-in with those credentials works; sign-out clears the session.
- Reset-request sends an email visible in Inbucket; following the link reaches update-password and the new password works.
- Form validation errors render inline (e.g. short password, bad email).

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Route gating + protected shell

### Overview

Add defense-in-depth gating: optimistic redirect in `proxy.ts` for unauthenticated hits on protected paths, plus an authoritative `getUser()` re-check in the `(protected)` layout. Add a stub gated page to prove the redirect.

### Changes Required:

#### 1. Proxy gating

**File**: `src/proxy.ts`

**Intent**: Redirect unauthenticated requests on protected paths to `/sign-in`, and signed-in users hitting auth pages to the gated area.

**Contract**: After the `getUser()` call (using its result), if no user and path is protected → `NextResponse.redirect('/sign-in')`; if user and path is an auth page → redirect to `/dashboard`. Preserve the refreshed-cookie response semantics (build the redirect from the same response cookies).

#### 2. Protected layout guard

**File**: `src/app/(protected)/layout.tsx`

**Intent**: Authoritative server-side gate — the proxy is optimistic, this is the backstop.

**Contract**: `async` server layout calls server client `getUser()`; if no user, `redirect('/sign-in')`. Renders children otherwise.

#### 3. Stub gated page

**File**: `src/app/(protected)/dashboard/page.tsx`

**Intent**: Minimal authenticated landing target to prove gating end-to-end (real dashboard is S-04).

**Contract**: Server component greeting the user's email + a sign-out button (calls `signOut` action). No product features.

### Success Criteria:

#### Automated Verification:

- Type check passes: `pnpm exec tsc --noEmit`.
- Lint passes: `pnpm lint`.
- Build succeeds: `pnpm build`.

#### Manual Verification:

- Visiting `/dashboard` while signed out redirects to `/sign-in`.
- Visiting `/sign-in` while signed in redirects to `/dashboard`.
- The protected layout still blocks even if the proxy matcher is bypassed (manually test by hitting the route).

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Playwright E2E

### Overview

Install Playwright and add automated regression for the auth flows against the local stack and dev server.

### Changes Required:

#### 1. Harness

**File**: `package.json`, `playwright.config.ts`

**Intent**: Add `@playwright/test` and configure it to run against the dev server + local Supabase.

**Contract**: `pnpm add -D @playwright/test` then `pnpm exec playwright install`. Config sets `webServer` to start `pnpm dev`, `baseURL` `http://127.0.0.1:3000`. Add a `test:e2e` script.

#### 2. Auth E2E specs

**File**: `e2e/auth.spec.ts`

**Intent**: Cover the full flow set.

**Contract**: Specs for sign-up → lands on dashboard; sign-out → back to sign-in; sign-in; gated-route redirect when signed out; password reset (read the email from Inbucket's API, follow the link, set new password, sign in). Use unique per-run emails to avoid collisions.

### Success Criteria:

#### Automated Verification:

- E2E suite passes: `pnpm test:e2e` (local stack running).
- Lint passes: `pnpm lint`.

#### Manual Verification:

- E2E run is stable across two consecutive runs (no flakiness on the reset/email step).

**Implementation Note**: Final phase — confirm the full suite green before archiving the change.

---

## Testing Strategy

### Unit Tests (Vitest):

- Server Action result/validation helpers (email shape, password length ≥ 6).

### E2E Tests (Playwright):

- Sign-up, sign-in, sign-out, gated-route redirect, password-reset round trip via Inbucket.

### Manual Testing Steps:

1. Sign up a new email; confirm user appears in Studio → Auth.
2. Sign out, sign back in.
3. Request reset; open Inbucket; follow link; set new password; sign in with it.
4. Hit `/dashboard` signed out → redirect to `/sign-in`.
5. Hit `/sign-in` signed in → redirect to `/dashboard`.

## Performance Considerations

Auth flows must complete within human-perception timing (PRD NFR). The proxy runs on every matched request — keep its matcher tight (exclude static assets) so refresh cost stays negligible.

## Migration Notes

No data migration. The proxy replaces the (nonexistent) middleware; no rollback of existing routing. `.env.local` is local-only and gitignored.

## References

- Roadmap item: `context/foundation/roadmap.md` → F-01
- PRD: `context/foundation/prd.md` → FR-001–005, Access Control
- Change identity + scope notes: `context/changes/minimal-auth-and-session/change.md`
- Reference form pattern: `wykonczymy/src/components/forms/hooks/form-hooks.ts`, `use-form-submit.ts`
- Next.js 16 proxy: verified via Context7 (`/vercel/next.js` v16 upgrade guide)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Local Supabase stack + env

#### Automated

- [x] 1.1 Stack reports healthy: `supabase status` — 1d86328
- [x] 1.2 `.env.local` exists with both `NEXT_PUBLIC_SUPABASE_*` vars — 1d86328

#### Manual

- [x] 1.3 Studio loads — 1d86328
- [x] 1.4 Inbucket/mailpit loads — 1d86328

### Phase 2: SSR clients + proxy session refresh

#### Automated

- [x] 2.1 Type check passes — 66ca8c0
- [x] 2.2 Lint passes — 66ca8c0
- [x] 2.3 Build compiles `proxy.ts` — 66ca8c0

#### Manual

- [x] 2.4 Session cookie refreshes on page load without error — 66ca8c0

### Phase 3: TanStack Form infra + auth pages + Server Actions

#### Automated

- [x] 3.1 Type check passes
- [x] 3.2 Lint passes
- [x] 3.3 Build succeeds
- [x] 3.4 Server Action helper unit test passes

#### Manual

- [x] 3.5 Sign-up creates a user + session
- [x] 3.6 Sign-in / sign-out work
- [x] 3.7 Reset email in Inbucket → link → update-password → new password works
- [x] 3.8 Inline validation errors render

### Phase 4: Route gating + protected shell

#### Automated

- [x] 4.1 Type check passes
- [x] 4.2 Lint passes
- [x] 4.3 Build succeeds

#### Manual

- [x] 4.4 `/dashboard` signed out → redirect to `/sign-in`
- [x] 4.5 `/sign-in` signed in → redirect to `/dashboard`
- [x] 4.6 Protected layout blocks even if proxy bypassed

### Phase 5: Playwright E2E

#### Automated

- [x] 5.1 E2E suite passes: `pnpm test:e2e`
- [x] 5.2 Lint passes

#### Manual

- [x] 5.3 E2E stable across two consecutive runs
