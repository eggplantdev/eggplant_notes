# Authenticated Contact Form Implementation Plan

## Overview

Add an authenticated-only contact form. A new site footer (rendered inside the `(protected)` layout) carries a "Contact me" button that opens a dialog; submitting it runs a Server Action that emails the app owner via standalone `nodemailer` over SMTP. The sender's identity is read server-side from the Supabase session — never supplied by the client — so the auth gate is the spam protection.

The feature's first server-only env vars (`EMAIL_*`) force an env-handling decision up front. Rather than patch it per-feature, Phase 0 establishes a **build-time-validated, server-isolated env layer** (reusable across the user's other repos): client and server vars both fail `next build` when missing/malformed, and server secrets are physically prevented from reaching the client bundle.

## Current State Analysis

- No footer exists. The authed shell is `src/app/(protected)/layout.tsx`, which already does the authoritative `getCurrentUser()` gate and renders `<AppNav />` + children.
- No email infrastructure: `nodemailer` is **not** in `package.json`; there is no `EMAIL_*` env wiring.
- `src/lib/env.ts` validates **only** `NEXT_PUBLIC_*` vars, eagerly at module load, and is **client-reachable** (the browser Supabase client imports `SUPABASE_URL`/`SUPABASE_ANON_KEY`). 6 modules import it: `src/proxy.ts`, `src/features/openrouter/server-client.ts`, `src/features/openrouter/actions/connect.ts`, `src/features/auth/actions/reset-password.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts` — all via the flat consts `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SITE_URL`.
- **There are no server-only env vars today** — `EMAIL_*` will be the first. This is why the env layer is built now.
- Validation today is **load-time**, not build-time: a missing var throws when the module is first evaluated at runtime, not during `next build`.
- `server-only` is **not a real package** in this repo (`node_modules/server-only` absent) — Next aliases it internally during _app_ compilation. Consequence: a module that does `import 'server-only'` **cannot be imported by `next.config.ts`** (config runs in plain Node, outside Next's app compilation, where the alias doesn't exist). 4 app files already use `import 'server-only'` successfully.
- `jiti@2.7.0` exists in the pnpm store as a transitive dep, but pnpm's strict layout means it is **not resolvable by name from `next.config.ts`** unless declared — it must be added as a direct devDependency.
- Patterns to mirror (unchanged): server action `src/features/settings/actions/update-daily-goal.ts`; form `src/features/notes/components/note-form.tsx`; dialog `src/features/account/components/delete-account-dialog.tsx`; SMTP send `/Users/konradantonik/workspace/portfolio/old_page/helpers/send-email.ts`; shared width `container-shell` `@utility`.

## Desired End State

1. **Env**: `next build` fails if any required client OR server env var is missing/malformed. Server vars live in a `server-only` module a client component cannot import (build error if attempted). `src/lib/env.ts`'s public API (`SUPABASE_URL`, etc.) is unchanged, so its 6 importers are untouched.
2. **Feature**: a signed-in user sees a footer on every protected page (© + "Eggplant" wordmark + "Contact me"). The button opens a dialog (Subject + Message); submit emails `EMAIL_TO` with `replyTo` = the user's account email, closes with a success toast; failure shows inline error + toast and keeps the dialog open. Logged-out users never reach it.

Verify: `pnpm typecheck && pnpm lint && pnpm build` pass with the 4 `EMAIL_*` vars set; build **fails** with any required var unset; a client import of the server env module **fails the build**; manual click-through delivers an email whose Reply-To is the signed-in user's address.

### Key Discoveries:

- `src/lib/env.ts` is client-reachable and eager — server vars can't join it (browser parse failure) and `server-only` can't be added to it (poisons it for the 6 client-side importers / the client bundle).
- Build-time failure has exactly one native source: `import 'server-only'` (build error when in the client graph). The Proxy/package alternatives are runtime-only.
- `server-only` is Next-internal here → not importable by `next.config.ts`. So the **server schema must live in a plain module** (no `server-only`) that `next.config` can import to validate, while the **parsed secret-bearing export** lives in the `server-only` module the app imports.
- Build-time _validation_ (vars exist/valid) is achieved by importing the env modules into `next.config.ts` (evaluated at build start) — this is the piece the reference repos lacked; they eager-validated but only at runtime.
- `getCurrentUser()` (`src/lib/supabase/server.ts:31-37`) returns the Supabase user; `user.email` is the Reply-To source.

## What We're NOT Doing

- No `@t3-oss/env-nextjs` or any env package — the native `server-only` + a small homegrown schema split gives a _stronger_ (build-time) guarantee than the package's runtime Proxy.
- No captcha, rate-limiting, or honeypot — the auth gate is the agreed spam control.
- No auto-reply email to the sender.
- No persistence of messages to the DB; no attachments.
- No footer on `(auth-pages)` or the root layout — authed-only.
- No change to the public API of `src/lib/env.ts` (keep the flat `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SITE_URL` exports) — avoids churning the 6 importers.
- No new shadcn primitives — `dialog`, `textarea`, `input`, `button`, `label` exist.

## Implementation Approach

Three phases. **Phase 0** builds the env layer (plain shared schema module + client entry + `server-only` server entry + `next.config` build-time wiring via jiti) and adds the `EMAIL_*` server vars. **Phase 1** adds the contact schema + send action consuming the server env. **Phase 2** builds the dialog, footer, and mounts it. The env layer is intentionally generic so the three files + two config lines port to the user's other repos.

## Critical Implementation Details

- **Schema vs secrets split** — `serverSchema` must live in a plain module importable by `next.config` (no `server-only`). The parsed `serverEnv` (the actual secret values) lives in the `server-only` module. `next.config` validates via `serverSchema.parse(process.env)`; the app reads secrets via the `server-only` export. This is what reconciles "build-time validate server vars" with "server-only can't be imported by next.config".
- **jiti API + Next 16 config** — verify `jiti@2.7` import API (sync callable vs async `.import`) and Next 16's support for module imports in `next.config.ts` against `node_modules/next/dist/docs/` and jiti docs (Context7) before wiring. Next loads `.env*` before evaluating the config, so `process.env` is populated at validation time.
- **Build now requires the 4 `EMAIL_*` vars** — once Phase 0 lands, `pnpm build` (local) and Vercel builds fail until the vars are present. This is the intended build-time guarantee; the vars must be in `.env.local` (dev) and added via `vercel env add` for preview + production before deploying.
- **Client static-inlining** — `client.ts`/`env.ts` must reference each `process.env.NEXT_PUBLIC_X` as a static literal (as today) so Next inlines them into the browser bundle; a dynamic `process.env` spread leaves them undefined client-side.

## Phase 0: Build-time-validated, server-isolated env layer

### Overview

Refactor env handling so both client and server vars fail the build when invalid, and server secrets cannot reach the client. Introduce the first server vars (`EMAIL_*`).

### Changes Required:

#### 1. jiti devDependency

**File**: `package.json`

**Intent**: Make `jiti` resolvable by name from `next.config.ts` (pnpm won't expose the transitive copy).

**Contract**: `pnpm add -D jiti`.

#### 2. Shared env schemas (plain module)

**File**: `src/lib/env-schema.ts` (new)

**Intent**: Single source of the zod shapes, free of side effects and `server-only`, so both the client/server entries and `next.config` can import it.

**Contract**: Mirror the portfolio repo's exact var names so existing SMTP values copy over 1:1. The sender/from address is public there (`NEXT_PUBLIC_EMAIL_USER`), only host/pass/to are secret. So: `clientSchema` = `z.object({ NEXT_PUBLIC_SUPABASE_URL: z.url(), NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1), NEXT_PUBLIC_SITE_URL: z.url().default('http://127.0.0.1:3000'), NEXT_PUBLIC_EMAIL_USER: z.email() })` and `serverSchema` = `z.object({ EMAIL_HOST: z.string().min(1), EMAIL_PASS: z.string().min(1), EMAIL_TO: z.email() })`. No `parse` call here.

#### 3. Client env entry (refactor existing)

**File**: `src/lib/env.ts`

**Intent**: Validate client vars eagerly from the shared schema; keep the existing public exports so the 6 importers don't change.

**Contract**: Import `clientSchema` from `./env-schema`; `const env = clientSchema.parse({ <static NEXT_PUBLIC_* literals, incl. NEXT_PUBLIC_EMAIL_USER> })`; re-export `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SITE_URL` exactly as today, plus `export const EMAIL_USER = env.NEXT_PUBLIC_EMAIL_USER` for the action. Client-safe (no `server-only`, no server keys).

#### 4. Server env entry (server-only)

**File**: `src/lib/env.server.ts` (new)

**Intent**: Provide the parsed server secrets to app server code, with a build-time guard against client import.

**Contract**: First line `import 'server-only'`. Import `serverSchema` from `./env-schema`; `export const serverEnv = serverSchema.parse(process.env)` (eager — safe, module never in client bundle).

#### 5. Build-time validation wiring

**File**: `next.config.ts`

**Intent**: Force both schemas to validate at the start of `next build` so a bad var fails the build.

**Contract**: At the top of the config, use jiti to import `./src/lib/env` (runs the client parse) and to import `./src/lib/env-schema` then call `serverSchema.parse(process.env)` (validates server vars without touching the `server-only` module). Exact jiti call form per verification note above. Existing `nextConfig` object unchanged.

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck` passes
- `pnpm lint` passes
- With all required env vars set, `pnpm build` passes
- Temporarily unsetting a required `NEXT_PUBLIC_*` var makes `pnpm build` **fail**
- Temporarily unsetting a required `EMAIL_*` var makes `pnpm build` **fail**
- jiti present in `package.json` devDependencies + lockfile

#### Manual Verification:

- Adding a throwaway client component that imports `@/lib/env.server` makes `pnpm build` fail with a server-only error (then remove it)
- The 6 existing importers of `@/lib/env` still resolve and the app runs (`/dashboard` loads)

**Implementation Note**: Requires the 4 `EMAIL_*` vars in `.env.local` to get a green build. After automated verification passes, pause for manual confirmation before Phase 1.

---

## Phase 1: Contact schema + send action

### Overview

Define the form schema and the auth-gated send action consuming `serverEnv`.

### Changes Required:

#### 1. nodemailer dependency

**File**: `package.json`

**Intent**: Add the mailer runtime + types (pure JS, no build-script allowlist entry needed).

**Contract**: `pnpm add nodemailer` + `pnpm add -D @types/nodemailer`.

#### 2. Contact form schema

**File**: `src/features/contact/schemas.ts` (new)

**Intent**: Validate the only two client-supplied fields; export the inferred type.

**Contract**: `contactSchema = z.object({ subject: z.string().min(1).max(120), message: z.string().min(1).max(2000) })`; `type ContactInputT = z.infer<typeof contactSchema>`.

#### 3. Send action

**File**: `src/features/contact/actions/send-contact-message.ts` (new)

**Intent**: Gate on auth, validate input, send one email to the owner with the user's address as Reply-To. Return `ActionResultT`; never throw to the client.

**Contract**: `'use server'`. `async function sendContactMessage(input: ContactInputT): Promise<ActionResultT>`. Steps: `getCurrentUser()` → no user/no email → `{ success: false, error: 'Not authenticated' }`; `contactSchema.safeParse` → error branch; module-scope `nodemailer.createTransport({ host: serverEnv.EMAIL_HOST, port: 465, secure: true, auth: { user: EMAIL_USER, pass: serverEnv.EMAIL_PASS } })` (`import { serverEnv } from '@/lib/env.server'` for host/pass/to; `import { EMAIL_USER } from '@/lib/env'` for the public user/from); `await transport.sendMail({ from: EMAIL_USER, to: serverEnv.EMAIL_TO, replyTo: user.email, subject: \`Contact: ${data.subject}\`, text: <email + subject + message> })`; thrown → `console.error`+`{ success: false, error: 'Failed to send message' }`; else `{ success: true }`.

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck` passes
- `pnpm lint` passes
- `pnpm build` passes
- nodemailer + `@types/nodemailer` present in `package.json` + lockfile

#### Manual Verification:

- Invoking the action (via Phase 2 UI) delivers an email to `EMAIL_TO`
- The delivered email's Reply-To is the signed-in user's address

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: UI — dialog, footer, mount

### Overview

Build the contact dialog, the footer that triggers it, and mount the footer in the protected layout.

### Changes Required:

#### 1. Contact dialog

**File**: `src/features/contact/components/contact-dialog.tsx` (new)

**Intent**: `'use client'` component owning its trigger button + open state + the form, mirroring `DeleteAccountDialog`. On submit: call `sendContactMessage`, toast the result, close + reset on success, keep open with inline error on failure.

**Contract**: shadcn `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`; own `<Button>Contact me</Button>` trigger. `useAppForm` `defaultValues { subject: '', message: '' }`; `form.AppField name="subject"` → `field.Input` (validators from `contactSchema.shape.subject`); `form.Field name="message"` → raw `Textarea` (per `note-form.tsx`); `toastActionResult(result, { successMessage: 'Message sent' })`, inline `FormError` on failure; submit via `form.Subscribe` ("Sending…" while submitting). File exports only the component.

#### 2. Site footer

**File**: `src/components/layout/site-footer.tsx` (new)

**Intent**: Non-domain layout primitive: © line + "Eggplant" wordmark + the contact trigger, edge-aligned with the nav.

**Contract**: `function SiteFooter()` (named export). `<footer>` using the `container-shell` `@utility`. Contains `© {year} Eggplant` (year computed inline), an "Eggplant" wordmark, and `<ContactDialog />`. Tailwind v4 utilities only — no arbitrary `[...]`/inline styles.

#### 3. Mount footer in protected layout

**File**: `src/app/(protected)/layout.tsx`

**Intent**: Render the footer once, app-wide for authed users, after the page content.

**Contract**: Import `SiteFooter`; render `<SiteFooter />` after the `<div className="pt-14 md:pt-0">{children}</div>` block.

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck` passes
- `pnpm lint` passes
- `pnpm build` passes

#### Manual Verification:

- Footer shows on protected pages (e.g. `/dashboard`) with © + Eggplant + "Contact me"; not on `/sign-in`
- "Contact me" opens the dialog; empty subject/message show inline validation errors
- Valid submit closes the dialog, shows a success toast, and delivers the email (Reply-To = the signed-in user)
- A simulated send failure shows inline error + error toast and keeps the dialog open
- Footer aligns with nav edges on mobile + desktop, no overflow

**Implementation Note**: After this phase + automated verification, pause for manual confirmation before the review gate.

---

## Testing Strategy

### Unit Tests:

- Per `context/foundation/test-plan.md`, author the unit/E2E layer at the post-`/simplify` review gate, not during implementation. Candidate unit target: `contactSchema` boundary validation. The send action is I/O-bound (SMTP) — verify manually/E2E.
- **Deferred (later TODO, portable env kit):** a Vitest spec over `env-schema.ts` asserting `clientSchema`/`serverSchema` accept valid and reject missing/malformed shapes — travels repo-to-repo with the schema file (no project-specific deps). The build-time guarantees ("build fails on a missing var"; "client import of `env.server.ts` fails the build") are **not** unit-testable — they need a build-assertion script (unset a var → assert `next build` exits non-zero), which travels with CI config, not Vitest.

### Manual Testing Steps:

1. Set the 4 `EMAIL_*` vars in `.env.local`; `supabase start`; sign in.
2. `pnpm build` passes; transiently unset a var → build fails (both a `NEXT_PUBLIC_*` and an `EMAIL_*`).
3. On `/dashboard`, click "Contact me" → dialog opens.
4. Submit empty → inline validation errors on both fields.
5. Fill subject + message, submit → dialog closes, success toast, email arrives at `EMAIL_TO` with Reply-To = your account email.
6. Break `EMAIL_PASS` at runtime → submit → error toast + inline error, dialog stays open.
7. Sign out → footer/dialog unreachable.

## Performance Considerations

Negligible. Transport created once at module scope (Fluid Compute reuse). jiti runs only at build start, not at runtime.

## Migration Notes

- No schema/DB changes.
- **New build-time requirement**: `EMAIL_HOST`, `NEXT_PUBLIC_EMAIL_USER`, `EMAIL_PASS`, `EMAIL_TO` (custom-domain SMTP, names mirrored from the portfolio repo) must exist in `.env.local` for local builds and be added via `vercel env add` (preview + production) before the next deploy — otherwise the Vercel build fails (by design). Never hand-edit `.env.local` for hosted values (AGENTS.md ritual). Note `NEXT_PUBLIC_EMAIL_USER` ships in the client bundle (it's the from-address, not a secret) — same trade the portfolio makes.

## References

- t3-env (pattern we are reproducing minimally, not adopting): `@t3-oss/env-nextjs` — build-time validation via config import.
- SMTP pattern: `/Users/konradantonik/workspace/portfolio/old_page/helpers/send-email.ts`
- Auth-gated action: `src/features/settings/actions/update-daily-goal.ts`
- Form pattern: `src/features/notes/components/note-form.tsx:115-138,185-198`
- Dialog-owns-trigger: `src/features/account/components/delete-account-dialog.tsx`
- Existing env + importers: `src/lib/env.ts`
- Mount point: `src/app/(protected)/layout.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 0: Build-time-validated, server-isolated env layer

#### Automated

- [x] 0.1 `pnpm typecheck` passes — 728be10
- [x] 0.2 `pnpm lint` passes — 728be10
- [x] 0.3 `pnpm build` passes with all env vars set — 728be10
- [x] 0.4 Unsetting a required `NEXT_PUBLIC_*` var fails `pnpm build` — 728be10
- [x] 0.5 Unsetting a required `EMAIL_*` var fails `pnpm build` — 728be10
- [x] 0.6 jiti present in devDependencies + lockfile — 728be10

#### Manual

- [x] 0.7 Client import of `@/lib/env.server` fails the build with a server-only error — 728be10
- [x] 0.8 The 6 existing `@/lib/env` importers still resolve; `/dashboard` loads — 728be10

### Phase 1: Contact schema + send action

#### Automated

- [x] 1.1 `pnpm typecheck` passes — d33ff7a
- [x] 1.2 `pnpm lint` passes — d33ff7a
- [x] 1.3 `pnpm build` passes — d33ff7a
- [x] 1.4 nodemailer + `@types/nodemailer` present in `package.json` + lockfile — d33ff7a

#### Manual

- [ ] 1.5 Action delivers an email to `EMAIL_TO`
- [ ] 1.6 Delivered email's Reply-To is the signed-in user's address

### Phase 2: UI — dialog, footer, mount

#### Automated

- [x] 2.1 `pnpm typecheck` passes
- [x] 2.2 `pnpm lint` passes
- [x] 2.3 `pnpm build` passes

#### Manual

- [ ] 2.4 Footer shows on protected pages, not on `/sign-in`
- [ ] 2.5 "Contact me" opens dialog; empty fields show inline validation
- [ ] 2.6 Valid submit closes dialog, success toast, email delivered (Reply-To = user)
- [ ] 2.7 Send failure shows inline error + toast, dialog stays open
- [ ] 2.8 Footer aligns with nav edges on mobile + desktop, no overflow
