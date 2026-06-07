# Authenticated Contact Form Implementation Plan

## Overview

Add an authenticated-only contact form. A new site footer (rendered inside the `(protected)` layout) carries a "Contact me" button that opens a dialog; submitting it runs a Server Action that emails the app owner via standalone `nodemailer` over SMTP. The sender's identity is read server-side from the Supabase session — never supplied by the client — so the auth gate is the spam protection (no captcha/rate-limiting for the MVP).

## Current State Analysis

- No footer exists. The authed shell is `src/app/(protected)/layout.tsx`, which already does the authoritative `getCurrentUser()` gate and renders `<AppNav />` + children.
- No email infrastructure: `nodemailer` is **not** in `package.json`; there is no `EMAIL_*` env wiring.
- `src/lib/env.ts` is **client-reachable** — it exports `NEXT_PUBLIC_*` values consumed in client components and runs `schema.parse(...)` at module load. Adding server-only `EMAIL_*` keys to that schema would make the parse throw in the browser bundle (those vars are `undefined` client-side). Server-only env must live in a separate `import 'server-only'` module.
- Established patterns to mirror:
  - **Server action**: `src/features/settings/actions/update-daily-goal.ts` — `'use server'`, `getCurrentUser()` gate returning `{ success: false, error }` when unauthenticated, returns `ActionResultT` (`src/types/action.ts`).
  - **Form**: `src/features/notes/components/note-form.tsx` — `useAppForm` (`src/components/forms/hooks/form-hooks.ts`), `form.AppField` + `field.Input` for single-line, raw `Textarea` via `form.Field` for multiline, `toastActionResult` (`src/components/forms/toast-result.ts`) + inline `FormError`, `form.Subscribe` for the pending submit button.
  - **Dialog owning its own trigger + open state**: `src/features/account/components/delete-account-dialog.tsx`.
  - **SMTP send (standalone, no Payload)**: `/Users/konradantonik/workspace/portfolio/old_page/helpers/send-email.ts` — `nodemailer.createTransport({ host, port: 465, secure: true, auth: { user, pass } })`, `sendMail` with `replyTo` = sender, returns `{ success }` and logs on failure.
- Shared page width is the `container-shell` `@utility` in `globals.css` (used by `AppNav` and `PageShell`) — the footer reuses it for edge alignment.

## Desired End State

A signed-in user sees a footer on every protected page (© line + "Eggplant" wordmark + "Contact me" button). Clicking "Contact me" opens a dialog with a **Subject** input and a **Message** textarea. Submitting sends one email to `EMAIL_TO` with `replyTo` set to the user's account email; on success the dialog closes and a success toast shows; on failure an inline error + error toast show and the dialog stays open. Logged-out users never reach the footer or the action.

Verify: `pnpm typecheck && pnpm lint && pnpm build` pass; manual click-through (with the 4 env vars set) delivers an email to the owner inbox whose Reply-To is the signed-in user's address.

### Key Discoveries:

- `(protected)/layout.tsx:14-21` is the single authed mount point — footer goes here, after `{children}`.
- `src/lib/env.ts:14-20` parses only `NEXT_PUBLIC_*` keys — server-only vars must NOT join this object (client-bundle parse failure). New module required.
- `note-form.tsx:185-198` shows the canonical raw-`Textarea` field via `form.Field` (the form hook only registers an `Input` field component, `form-hooks.ts:8-10`).
- `getCurrentUser()` (`src/lib/supabase/server.ts:31-37`) returns the Supabase user; `user.email` is the Reply-To source.
- `update-daily-goal.ts:14-15` is the exact auth-gate shape to copy.

## What We're NOT Doing

- No captcha, rate-limiting, or honeypot — the auth gate is the agreed spam control for the MVP.
- No auto-reply email to the sender (internal feedback; owner doesn't need a self-receipt).
- No persistence of messages to the DB / Supabase table — email only.
- No attachments, no rich text, no file upload.
- No footer on the `(auth-pages)` or root layout — authed-only by decision.
- No new shadcn primitives — `dialog.tsx`, `textarea.tsx`, `input.tsx`, `button.tsx`, `label.tsx` already exist.

## Implementation Approach

Two phases: backend first (dependency, server-only env, schema, action — independently typecheck/lint/build-verifiable), then UI (dialog + footer + mount). The action is provider-agnostic; custom-SMTP credentials are supplied via env (`vercel env add` for preview/prod, `.env.local` for dev). The email body is plain text (name/email/subject/message); `replyTo` lets the owner reply directly to the user from their inbox.

## Critical Implementation Details

- **Server-only env isolation** — the SMTP vars must be validated in a module that begins with `import 'server-only'` so a stray client import fails at build, and so the parse never runs in the browser. Do **not** extend `src/lib/env.ts`.
- **Identity is server-derived** — the Zod schema for the form has only `subject` + `message`. The user's email is read from `getCurrentUser()` inside the action and used for `replyTo`; it is never a form field (prevents spoofing and keeps the form minimal).
- **Transport is created at module scope** in the action file (matches the portfolio reference) so it's reused across invocations under Fluid Compute; `port: 465, secure: true`.

## Phase 1: Backend — dependency, server-only env, schema, action

### Overview

Install nodemailer, validate SMTP env in a server-only module, define the form schema, and implement the send action.

### Changes Required:

#### 1. nodemailer dependency

**File**: `package.json` (via pnpm)

**Intent**: Add the mailer runtime + its types. nodemailer is pure JS with no postinstall build script, so no `pnpm-workspace.yaml` `allowBuilds` entry is needed.

**Contract**: `pnpm add nodemailer` + `pnpm add -D @types/nodemailer`. Lockfile updated.

#### 2. Server-only SMTP env

**File**: `src/lib/env-server.ts` (new)

**Intent**: Validate the four custom-SMTP vars at server module load, failing loudly on a missing/malformed value, without ever reaching the client bundle.

**Contract**: First line `import 'server-only'`. Zod schema with `EMAIL_HOST` (`string().min(1)`), `EMAIL_USER` (`string().email()`), `EMAIL_PASS` (`string().min(1)`), `EMAIL_TO` (`string().email()`). Parse `process.env` (explicit static keys, mirroring `env.ts`'s style) and export the typed values (e.g. `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_TO`).

#### 3. Contact form schema

**File**: `src/features/contact/schemas.ts` (new)

**Intent**: Validate the only two client-supplied fields. Export the inferred input type for the form + action.

**Contract**: `contactSchema = z.object({ subject: z.string().min(1).max(120), message: z.string().min(1).max(2000) })`; export `type ContactInputT = z.infer<typeof contactSchema>`.

#### 4. Send action

**File**: `src/features/contact/actions/send-contact-message.ts` (new)

**Intent**: Gate on auth, validate input, send one email to the owner with the user's address as Reply-To. Return `ActionResultT`; never throw to the client.

**Contract**: `'use server'`. Signature `async function sendContactMessage(input: ContactInputT): Promise<ActionResultT>`. Steps: `getCurrentUser()` → if no user or no `user.email`, return `{ success: false, error: 'Not authenticated' }`; `contactSchema.safeParse(input)` → return `{ success: false, error }` on failure; create a module-scope `nodemailer` transport from `env-server` values (`port: 465, secure: true`); `await transport.sendMail({ from: EMAIL_USER, to: EMAIL_TO, replyTo: user.email, subject: \`Contact: ${data.subject}\`, text: <user email + subject + message> })`; on thrown error, `console.error`and return`{ success: false, error: 'Failed to send message' }`; else `{ success: true }`.

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck` passes
- `pnpm lint` passes
- `pnpm build` passes
- nodemailer + `@types/nodemailer` present in `package.json` and `pnpm-lock.yaml`

#### Manual Verification:

- With the 4 `EMAIL_*` vars set in `.env.local`, invoking the action (via the Phase 2 UI) delivers an email to `EMAIL_TO`
- The delivered email's Reply-To is the signed-in user's address

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: UI — dialog, footer, mount

### Overview

Build the contact dialog (form), the footer that triggers it, and mount the footer in the protected layout.

### Changes Required:

#### 1. Contact dialog

**File**: `src/features/contact/components/contact-dialog.tsx` (new)

**Intent**: A `'use client'` component owning its trigger button + open state and the form, mirroring `DeleteAccountDialog`. On submit, calls `sendContactMessage`, toasts the result, closes + resets on success, keeps open with inline error on failure.

**Contract**: Uses shadcn `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`. Renders its own `<Button>Contact me</Button>` as the trigger. `useAppForm` with `defaultValues { subject: '', message: '' }`; `form.AppField name="subject"` → `field.Input` (validators from `contactSchema.shape.subject`); `form.Field name="message"` → raw `Textarea` (per `note-form.tsx`); `toastActionResult(result, { successMessage: 'Message sent' })`, inline `FormError` on failure; submit button via `form.Subscribe` (disabled + "Sending…" while submitting). Component file exports only the component (per react rules).

#### 2. Site footer

**File**: `src/components/layout/site-footer.tsx` (new)

**Intent**: Non-domain layout primitive: © line + "Eggplant" wordmark + the contact trigger. Edge-aligned with the nav.

**Contract**: `function SiteFooter()` (named export, `function` keyword). Outer `<footer>` using the `container-shell` `@utility` for width/padding (no re-rolled `mx-auto max-w-*`). Contains `© {year} Eggplant` (compute year inline), an "Eggplant" wordmark span, and `<ContactDialog />`. Tailwind v4 utilities only — no arbitrary `[...]`/inline styles.

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
- A simulated send failure shows the inline error + error toast and keeps the dialog open
- Layout/responsive: footer aligns with nav edges on mobile + desktop, no overflow

**Implementation Note**: After this phase and automated verification, pause for manual confirmation before the review gate.

---

## Testing Strategy

### Unit Tests:

- Per `context/foundation/test-plan.md`, author the unit/E2E layer only at the post-`/simplify` review gate (CLAUDE.md per-slice gate), not during implementation. Candidate unit target: `contactSchema` boundary validation (subject/message min/max). The send action is I/O-bound (SMTP) and better verified manually/E2E than unit-mocked.

### Manual Testing Steps:

1. Set the 4 `EMAIL_*` vars in `.env.local`; `supabase start`; sign in.
2. On `/dashboard`, click "Contact me" → dialog opens.
3. Submit empty → inline validation errors on both fields.
4. Fill subject + message, submit → dialog closes, success toast, email arrives at `EMAIL_TO` with Reply-To = your account email.
5. Temporarily break `EMAIL_PASS` → submit → error toast + inline error, dialog stays open.
6. Sign out → confirm footer/dialog are unreachable.

## Performance Considerations

Negligible. The transport is created once at module scope and reused (Fluid Compute). A single synchronous send per submit; no batching needed.

## Migration Notes

None — no schema/DB changes. New env vars `EMAIL_HOST/EMAIL_USER/EMAIL_PASS/EMAIL_TO` must be added via `vercel env add` (preview + production) and `.env.local` (dev) using the custom-domain SMTP host/mailbox credentials. Never hand-edit `.env.local` for the hosted values — use the Vercel ritual (AGENTS.md).

## References

- SMTP pattern (standalone nodemailer): `/Users/konradantonik/workspace/portfolio/old_page/helpers/send-email.ts`
- Auth-gated action shape: `src/features/settings/actions/update-daily-goal.ts`
- Form pattern (Input + raw Textarea): `src/features/notes/components/note-form.tsx:115-138,185-198`
- Dialog-owns-trigger pattern: `src/features/account/components/delete-account-dialog.tsx`
- Mount point: `src/app/(protected)/layout.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Backend — dependency, server-only env, schema, action

#### Automated

- [ ] 1.1 `pnpm typecheck` passes
- [ ] 1.2 `pnpm lint` passes
- [ ] 1.3 `pnpm build` passes
- [ ] 1.4 nodemailer + `@types/nodemailer` present in `package.json` and lockfile

#### Manual

- [ ] 1.5 Action delivers an email to `EMAIL_TO` with the 4 env vars set
- [ ] 1.6 Delivered email's Reply-To is the signed-in user's address

### Phase 2: UI — dialog, footer, mount

#### Automated

- [ ] 2.1 `pnpm typecheck` passes
- [ ] 2.2 `pnpm lint` passes
- [ ] 2.3 `pnpm build` passes

#### Manual

- [ ] 2.4 Footer shows on protected pages, not on `/sign-in`
- [ ] 2.5 "Contact me" opens dialog; empty fields show inline validation
- [ ] 2.6 Valid submit closes dialog, success toast, email delivered (Reply-To = user)
- [ ] 2.7 Send failure shows inline error + toast, dialog stays open
- [ ] 2.8 Footer aligns with nav edges on mobile + desktop, no overflow
