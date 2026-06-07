# Authenticated Contact Form — Plan Brief

> Full plan: `context/changes/contact-form/plan.md`

## What & Why

Add a contact form so signed-in users can email the app owner. It's authenticated-only by design: requiring a Supabase session is the spam control, so there's no captcha/rate-limiting. Sends go through standalone `nodemailer` over SMTP. Because `EMAIL_*` are the project's first server-only env vars, the change also lays down a **build-time-validated, server-isolated env layer** — a reusable pattern for the user's other repos.

## Starting Point

No footer, no email infra, `nodemailer` not installed. `src/lib/env.ts` validates only `NEXT_PUBLIC_*`, eagerly, and is client-reachable (6 importers). Validation today is load-time, not build-time. `server-only` is Next-internal here (not a real package) and 4 app files use it. `jiti@2.7` is present transitively but not directly resolvable.

## Desired End State

`next build` fails if any required client OR server var is missing/malformed; server secrets cannot reach the browser (a client import of the server env module fails the build). Signed-in users get a footer (© + "Eggplant" + "Contact me") that opens a Subject/Message dialog; submit emails the owner with `replyTo` = the user's address, closes with a success toast; failures keep the dialog open with an inline error. Logged-out users never reach it.

## Key Decisions Made

| Decision          | Choice                                     | Why                                                                                                                         | Source     |
| ----------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Access            | Authenticated-only                         | Auth gate replaces captcha/rate-limiting                                                                                    | Brainstorm |
| Trigger location  | Footer in `(protected)` layout             | Authed-only mount                                                                                                           | Plan       |
| Sender identity   | Server-derived from session                | Can't be spoofed                                                                                                            | Brainstorm |
| Mailer            | Standalone nodemailer (no Payload)         | Portfolio repo proves it                                                                                                    | Brainstorm |
| Auto-reply        | None                                       | Internal feedback                                                                                                           | Brainstorm |
| Env validation    | Build-time fail for client **and** server  | User requirement; references only had runtime fail                                                                          | Discussion |
| Env isolation     | `server-only` module + plain shared schema | Only native source of a build-time leak guard; `server-only` can't be imported by `next.config`, so the schema is split out | Discussion |
| Env package       | None (homegrown split)                     | `server-only` gives a _stronger_ build-time guard than t3-env's runtime Proxy                                               | Discussion |
| Build-time wiring | jiti-import env into `next.config.ts`      | Forces validation at build start                                                                                            | Discussion |

## Scope

**In scope:** build-time-validated env layer (`env-schema.ts` + `env.ts` + `env.server.ts` + `next.config` wiring + jiti devDep), `EMAIL_*` vars, nodemailer, contact schema + send action, dialog, footer, mount.

**Out of scope:** env package, captcha/rate-limiting, auto-reply, DB persistence, attachments, footer on auth/root layout, changing `env.ts`'s public API, new shadcn primitives.

## Architecture / Approach

`env-schema.ts` (plain `clientSchema` + `serverSchema`) is imported by: `env.ts` (eager client parse, unchanged public exports), `env.server.ts` (`import 'server-only'` + eager `serverEnv`), and `next.config.ts` (validates both at build start via jiti). Footer → `ContactDialog` (`useAppForm`) → `sendContactMessage` action → `getCurrentUser()` gate → nodemailer transport from `serverEnv` → email to `EMAIL_TO`, `replyTo` = user email.

## Phases at a Glance

| Phase        | What it delivers                                                     | Key risk                                                                      |
| ------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 0. Env layer | Build-time-validated, server-isolated env (+ jiti, EMAIL\_\* schema) | jiti API / Next 16 config import form; `server-only` not importable by config |
| 1. Action    | nodemailer dep, contact schema, send action                          | SMTP creds must exist for a real send                                         |
| 2. UI        | Contact dialog, footer, mount                                        | Footer edge-alignment / responsive overflow                                   |

**Prerequisites:** local Supabase up; the 4 `EMAIL_*` vars (custom SMTP) in `.env.local` — required for a green build once Phase 0 lands; `vercel env add` them before deploying.
**Estimated effort:** ~1–2 sessions, 3 phases.

## Open Risks & Assumptions

- jiti 2.7 call form (sync vs async) and Next 16 `next.config.ts` module-import support must be verified against the installed docs before wiring.
- Phase 0 makes the build hard-depend on `EMAIL_*` — local and Vercel builds fail until the vars are set (intended, but blocks green build until creds exist).
- Sign-up must stay non-trivially-botted for "auth = spam control" to hold (Supabase email-confirm is the gate).

## Success Criteria (Summary)

- `next build` fails on any missing/invalid client or server env var; a client import of the server env module fails the build.
- A signed-in user can send a message that lands in the owner inbox with Reply-To = their address.
- Logged-out users cannot reach the footer, dialog, or action.
