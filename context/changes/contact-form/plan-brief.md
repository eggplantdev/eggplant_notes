# Authenticated Contact Form — Plan Brief

> Full plan: `context/changes/contact-form/plan.md`

## What & Why

Add a contact form so signed-in users can email the app owner. It's authenticated-only by design: requiring a Supabase session is the spam control, so there's no captcha or rate-limiting in the MVP. Sends go through standalone `nodemailer` over SMTP.

## Starting Point

No footer and no email infrastructure exist. The authed shell is `src/app/(protected)/layout.tsx` (already does the `getCurrentUser()` gate + renders `AppNav`). `nodemailer` is not installed. The project has proven patterns for auth-gated server actions, `useAppForm` forms, and dialogs that own their own trigger.

## Desired End State

Signed-in users see a footer on every protected page (© + "Eggplant" wordmark + "Contact me"). The button opens a dialog with Subject + Message; submitting emails `EMAIL_TO` with `replyTo` set to the user's account email, then closes with a success toast. Failures show an inline error + toast and keep the dialog open. Logged-out users never reach it.

## Key Decisions Made

| Decision         | Choice                                        | Why                                                                         | Source     |
| ---------------- | --------------------------------------------- | --------------------------------------------------------------------------- | ---------- |
| Access           | Authenticated-only                            | Auth gate replaces captcha/rate-limiting for MVP                            | Brainstorm |
| Trigger location | New footer in `(protected)` layout            | Authed-only mount; contact UI only exists behind the gate                   | Plan       |
| Sender identity  | Server-derived from session, not a form field | Can't be spoofed; keeps form to subject+message                             | Brainstorm |
| Mailer           | Standalone nodemailer (no Payload)            | Portfolio repo proves the pattern; Payload absent here                      | Brainstorm |
| Auto-reply       | None                                          | Internal feedback; owner needs no self-receipt                              | Brainstorm |
| Env isolation    | Separate `import 'server-only'` module        | `lib/env.ts` is client-reachable; server vars would break the browser parse | Plan       |
| SMTP provider    | Custom SMTP (own domain)                      | Branded from-address                                                        | Plan       |

## Scope

**In scope:** footer, contact dialog + form, send action, server-only SMTP env, nodemailer dependency.

**Out of scope:** captcha/rate-limiting, auto-reply, DB persistence, attachments, footer on auth/root layout, new shadcn primitives.

## Architecture / Approach

Footer (`components/layout/site-footer.tsx`) → renders `ContactDialog` (`features/contact/`, `useAppForm`) → on submit calls `sendContactMessage` Server Action → action re-checks auth, validates `contactSchema`, reads `user.email` for `replyTo`, sends via a module-scope nodemailer transport to `EMAIL_TO`. SMTP creds validated in `lib/env-server.ts`.

## Phases at a Glance

| Phase      | What it delivers                                     | Key risk                                                                |
| ---------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| 1. Backend | nodemailer dep, server-only env, schema, send action | Server-only env leaking into client bundle (mitigated by `server-only`) |
| 2. UI      | Contact dialog, footer, mount in protected layout    | Footer edge-alignment / responsive overflow                             |

**Prerequisites:** local Supabase up; 4 `EMAIL_*` vars (custom SMTP) in `.env.local` for a real send-test.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- SMTP credentials for the custom domain mailbox must exist before a real send-test; until then code is provider-agnostic and only typecheck/lint/build are verifiable.
- Sign-up itself must stay non-trivially-botted for the "auth = spam control" assumption to hold (Supabase email-confirm is the gate).

## Success Criteria (Summary)

- A signed-in user can send a message that lands in the owner inbox with Reply-To = their address.
- Logged-out users cannot reach the footer, dialog, or action.
- Empty fields are blocked with inline validation; send failures are surfaced without losing the user's input.
