---
date: 2026-06-09T10:58:36+0200
researcher: ex-Plant
git_commit: f9876216cab9bbcc4927ff37fea2c3da89fa7041
branch: feat/new-user-welcome-dialog
repository: coding-learning-companion
topic: 'Settings CLI-token management UI + downloadable agent skill (expose-cli-note-api Phase 2)'
tags: [research, codebase, api-tokens, settings, route-handler, forms]
status: complete
last_updated: 2026-06-09
last_updated_by: ex-Plant
---

# Research: Settings CLI-token UI + downloadable agent skill

**Date**: 2026-06-09T10:58:36+0200
**Researcher**: ex-Plant
**Git Commit**: f9876216cab9bbcc4927ff37fea2c3da89fa7041
**Branch**: feat/new-user-welcome-dialog (research run here; the slice should get its OWN branch/worktree before implementing — a parallel session owns this one)
**Repository**: coding-learning-companion

## Research Question

Ground the plan for Phase 2 of `expose-cli-note-api`: (1) a Settings UI to mint/name/revoke personal API tokens (`clc_` tokens, hash-stored, raw shown once); (2) a "Download skill" route that serves `clc-note-api.skill.md` with `{{CLC_BASE_URL}}` replaced by the request origin. Focus: existing Settings structure + Server-Action wiring, the `useAppForm` form pattern, the `api_tokens` table/RLS + `resolve_api_token` from merged Phase 1, any "show-secret-once" precedent, and Route-Handler file-serving with origin injection.

## Summary

The backend half of this slice **already exists and is merged** — `api_tokens` table, RLS (incl. an `authenticated` insert policy), `resolve_api_token`, and the token helpers (`generateToken`/`hashToken`). What's missing is purely the **UI + two Server Actions + one download route**. Everything maps onto established repo patterns with **two things that must be built fresh**: a wider action-return type (mint returns the raw token once) and a show-once + copy-to-clipboard modal (no clipboard/reveal infra exists anywhere in the repo).

Load-bearing facts that shape the plan:

- **No service-role, no DEFINER mint RPC needed.** `api_tokens_insert_own` (RLS, `authenticated`, `with check user_id = auth.uid()`) is live — the mint action inserts under the user's own session like any other Settings write. (This corrects the archived Phase-1 plan's "no client insert policy" note; the shipped migration added it ahead of Phase 2.)
- **Revoke = `update revoked_at`** — there is deliberately no delete policy (audit trail).
- **The mint action must return `{ success: true; rawToken }`** — the standard `ActionResultT` doesn't fit (it carries no payload); widen it for this one action.
- **Show-once + clipboard must be built** — zero precedent in the repo. shadcn `Dialog`/`Input`/`Button` primitives exist to assemble it.
- **Download route**: derive origin with the existing `connect.ts` host-header pattern; serve the template as a **TS string constant** (lowest Vercel-bundle risk) with `{{CLC_BASE_URL}}` replaced; `Content-Disposition: attachment`.

## Detailed Findings

### Area 1 — `api_tokens` table, RLS, and what the UI can do directly

`supabase/migrations/20260609120000_api_tokens.sql`:

- Table (`:8-18`): `id, user_id (default auth.uid(), on delete cascade), token_hash (unique), name, scopes text[] default '{}', expires_at, last_used_at, revoked_at, created_at`.
- RLS policies (`:26-31`): `api_tokens_select_own`, **`api_tokens_insert_own` (with check `user_id = auth.uid()`)**, `api_tokens_update_own`. All `to authenticated`. → mint = direct insert; list = direct select; revoke = direct update, all under the normal cookie-session client. No service-role.
- No delete policy (`:23-24` comment): **revoke by setting `revoked_at`**, never delete — keeps the audit row.
- `last_used_at` is bumped by `resolve_api_token` on every API call (`:46`) → the list's "last used" column reads straight off the row.
- `resolve_api_token` (`:36-56`) is the request-auth path only (SECURITY DEFINER, granted `anon`); the UI layer does NOT touch it.

### Area 2 — Settings page + section + form + action wiring

- `src/app/(protected)/settings/page.tsx` — async **Server Component**; fetches all section data in one `Promise.all` (`:11`), renders each as `<SettingsSection title=… description=…>` wrapping a feature component (`:16-44`), passing server data as props (e.g. `<DailyGoalForm dailyGoal={dailyGoal} />` `:20`). **A new "CLI Tokens" section slots in as another `<SettingsSection>` block + `getApiTokens()` added to the `Promise.all`.**
- `src/features/settings/components/settings-section.tsx` — reusable presentational wrapper; props `title`, `description`, `children`, optional `variant: 'default' | 'danger'`, `className` (`:6-14`). Reuse as-is.
- `src/features/settings/components/daily-goal-form.tsx` — canonical form (`'use client'`): `useAppForm` from `@/components/forms/hooks/form-hooks` (`:4,16`); `useFormError()` → `{ formError, clearError, reportResult }` (`:14`); calls the action then `reportResult(result, { successMessage })` (`:18-21`); pending via `<form.Subscribe selector={s => s.isSubmitting}>` (`:44-50`); `<FormError message={formError} />` (`:42`); per-field Zod `validators={{ onBlur, onSubmit }}` (`:35`).
- `src/features/settings/actions/update-daily-goal.ts` — canonical action (`'use server'`): `getCurrentUser()` guard (`:7,14-15`) → `runTableAction(schema, input, (supabase, data) => …)` (`:17-24`, which internally `validateInput`s + builds its own RLS-scoped `createClient()` + normalizes to `ActionResultT`) → `revalidatePath('/dashboard')` → `return { success: true }`.
- Return contract: `ActionResultT = { success: true } | { success: false; error: string }` (`src/types/action.ts:1`).
- For a button (not a form) action like **revoke**: `useActionTransition()` (`src/hooks/use-action-transition.ts:11-31`) — `run(() => revokeToken(id), { successMessage })` with `isPending`. Used by `SampleDataSection` (`sample-data-section.tsx:10-25`) and wrapped by `DeleteButton` (`src/components/ui/delete-button.tsx:43,59-63`, owns its own confirm dialog).

### Area 3 — Credential-flow analog (OpenRouter) + the show-once gap

- `src/features/openrouter/components/connect-card.tsx:17` — server component branching `if (connected)` → mirror for empty-state-vs-list. Disconnect is an inline `<form action={async () => { 'use server'; await disconnectOpenRouter() }}>` (`:24-33`).
- `src/features/openrouter/actions/disconnect.ts:10-24` — the **revoke template**: `getCurrentUser()` → `supabase.from(...).delete/update().eq('user_id', user.id)` → `revalidatePath('/settings')` → `ActionResultT`. For us: `.update({ revoked_at: new Date().toISOString() }).eq('id', tokenId)` (RLS scopes ownership).
- **Critical divergence:** OpenRouter's secret is _never shown_ (PKCE OAuth, key arrives server-side, AES-GCM encrypted via `src/lib/crypto/aes-gcm.ts`). Ours **shows the raw token once**. → mirror the _structure_ (status card / inline action), **not** the secret-handling. **Ignore `aes-gcm.ts` entirely** — the token is hash-only, never recovered; SHA-256 in `token.ts` is correct.
- `src/features/contact/components/contact-dialog.tsx` — closest **form-in-a-Dialog** pattern (owns its own `open` state, `useAppForm`, `onSubmit` → action → `toastActionResult`/inline error) — the right shape for the mint modal.
- **Show-once + clipboard infra does NOT exist.** Grep for `navigator.clipboard` / `writeText` / `clipboard` / `copied` / `reveal` / `show-once` → **zero component hits.** Build fresh from: `src/components/ui/dialog.tsx` (`Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose` `:134-145`), `src/components/ui/input.tsx:5` (read-only), `src/components/ui/button.tsx:57` (variants incl. `ai` glow — used by the OpenRouter CTA), copy via `navigator.clipboard.writeText(raw)` + `toastMessage('Copied', 'success')` (`src/components/toasts.ts:11`). ~5 lines of copy logic.

### Area 4 — Download route: origin injection + serving the template

- Route-handler conventions: `export async function GET(request: Request)`, `NextResponse.json(body, { status })`; token routes use plain `Request` (`src/app/api/notes/route.ts:12,32`; `subjects/route.ts:10`). Uniform error envelope `errorJson(status, msg)` (`src/features/api-tokens/route-helpers.ts:6-8`).
- **Origin derivation — reuse the established pattern** in `src/features/openrouter/actions/connect.ts:12-17`: read `host` header, infer proto (`localhost`/`127.0.0.1` → http else https), fall back to `SITE_URL` (`src/lib/env.ts:22`). Its comment notes this beats a pinned URL because it works on preview deploys + the e2e port. (`reset-password.ts:13` uses the `origin` header as a simpler variant; `new URL(request.url).origin` also works on Vercel.)
- **Template storage:** `public/` exists but serves files verbatim (can't inject) → wrong. No `?raw`-import precedent. FS precedent is `node:fs/promises` + `path.join(process.cwd(), …)` (`src/lib/ai-debug/log-generation.ts:1-2,14`), and **reads** of committed files work on Vercel (only writes outside `/tmp` fail). **Recommended: a TS string constant** (e.g. `src/features/api-tokens/skill-template.ts`) exporting the markdown with the `{{CLC_BASE_URL}}` token — guaranteed bundled, no `process.cwd()` output-tracing risk. Trade-off: loses `.md` editability; the `fs.readFile` route is the fallback if keeping a raw `.md` matters.
- The template already carries the injection point: `clc-note-api.skill.md:23` → `BASE={{CLC_BASE_URL}}`. Route does `template.replace('{{CLC_BASE_URL}}', origin)`.
- Download response (plain Fetch `Response`, unchanged in this Next version):
  ```ts
  return new NextResponse(filled, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="clc-note-api.skill.md"',
    },
  })
  ```

### Area 5 — Token helpers to reuse

- `src/features/api-tokens/token.ts`: `TOKEN_PREFIX = 'clc_'` (`:3`); `generateToken(): { raw, hash }` (`:7-10`, 256-bit base64url, prefixed, hashes internally); `hashToken(raw): string` (`:14-16`, SHA-256 hex). The mint action only needs `generateToken()`. `node:crypto` → server-only (fine in `'use server'`).
- ⚠️ `src/features/api-tokens/schemas.ts` currently holds only `noteAttachCardsSchema` (the route body schema for the note-attach branch) — **not** a token schema. The new token-name / mint Zod schema must be written fresh; name it clearly so it isn't confused with the route-body schema (both legitimately live under `api-tokens/`).

## Code References

- `supabase/migrations/20260609120000_api_tokens.sql:8-31,36-56` — table, RLS (incl. insert policy), `resolve_api_token`
- `src/app/(protected)/settings/page.tsx:11,16-44` — section composition + Promise.all
- `src/features/settings/components/settings-section.tsx:6-14` — reusable wrapper
- `src/features/settings/components/daily-goal-form.tsx:4,14,16,18-21,35,42,44-50` — canonical form wiring
- `src/features/settings/actions/update-daily-goal.ts:7,14-24,27-28` — canonical action
- `src/types/action.ts:1` — `ActionResultT`
- `src/hooks/use-action-transition.ts:11-31` · `src/components/ui/delete-button.tsx:43,59-63` — button-action / revoke pattern
- `src/features/openrouter/components/connect-card.tsx:17,24-33` · `actions/disconnect.ts:10-24` — credential card + revoke template
- `src/features/contact/components/contact-dialog.tsx` — form-in-Dialog (mint modal shape)
- `src/components/ui/dialog.tsx:134-145` · `input.tsx:5` · `button.tsx:57` · `src/components/toasts.ts:11` — show-once modal primitives
- `src/features/openrouter/actions/connect.ts:12-17` — origin derivation pattern
- `src/lib/ai-debug/log-generation.ts:1-2,14` — `process.cwd()` FS-read precedent
- `src/lib/env.ts:22` — `SITE_URL`
- `src/features/api-tokens/token.ts:3,7-10,14-16` — `generateToken`/`hashToken`
- `context/changes/cli-token-ui-and-skill-download/clc-note-api.skill.md:23` — `{{CLC_BASE_URL}}` injection point

## Architecture Insights

- **Feature-first, no barrels** — the new UI layer is additive in `src/features/api-tokens/`: `queries.ts` (`getApiTokens`), `actions/mint-api-token.ts` + `actions/revoke-api-token.ts`, `components/api-tokens-section.tsx` + `mint-token-form.tsx` (+ the show-once modal). Sits alongside the existing headless request-auth files; direct per-file imports.
- **Two Settings idioms, pick per contract** (matches the repo's documented delete-UI lesson): a **form** (`useAppForm` + `useFormError`) for mint; a **button transition** (`useActionTransition`/`DeleteButton`) for revoke. Don't force one shape on both.
- **The one place `ActionResultT` doesn't fit** — mint must return the secret once. Widen to `{ success: true; rawToken: string } | { success: false; error: string }`. `toastActionResult`/`reportResult` read only `.success`/`.error`, so the wider success shape flows through; the form reads `result.rawToken` itself to open the modal.
- **Origin-at-request-time over a pinned env URL** — the repo already prefers reconstructing from the `host` header (works on preview + e2e), which is exactly right for injecting `BASE` into a per-deployment skill download.
- **Template as code, not asset** — serving with injection rules out `public/`; a bundled TS constant is the lowest-risk home given Vercel output tracing.

## Historical Context (from prior changes)

- `context/archive/2026-06-06-expose-cli-note-api/plan.md:35-44` — Phase-1 "What We're NOT Doing" explicitly parks the token-management UI and a `gh`-style **device/OAuth authorization flow** for Phase 2; this slice does the UI (manual copy-once), leaving device-flow + rate-limiting + scope-enforcement still parked.
- `context/archive/2026-06-06-expose-cli-note-api/plan.md:82` — the Phase-1 plan text said "no client `insert` policy (SQL-minted in Phase 1)", but the **shipped migration** (`:28-29`) added `api_tokens_insert_own` anyway, anticipating this UI. Trust the migration.
- `context/archive/2026-06-06-expose-cli-note-api/USAGE.md` — the SQL/`curl` mint doc this slice's UI replaces (and whose `null` example/code_context bug the new skill artifact already fixes to `""`).

## Open Questions

1. **Download-route auth** — gate `GET /api/skill` behind the session (it's a Settings feature) or leave public? It contains no secret (just the public origin + API docs), so public is defensible; session-gating is tidier. Plan decision.
2. **Token expiry UI** — offer an expiry selector at mint (schema has `expires_at`) or always non-expiring for v1? Leaning: optional, default never-expires.
3. **Revoked tokens in the list** — show greyed (audit visibility) or hide? Leaning: hide revoked, or a collapsed "revoked" group.
4. **Servable template format** — TS string constant (recommended) vs keep `.md` + `fs.readFile`. Decide before implement; if TS const, the change-folder `.md` stays the human-readable source and gets mirrored into the constant (and they must not drift).
5. **`scopes`** — stored but unenforced (Phase 1). Mint UI = name only, no scope picker this slice. Confirm.
6. **Skill-content delivery** — does the download also need the BASE to be correct for `localhost` dev? The origin pattern handles it, but a downloaded-from-prod skill is the real target.

## Related Research

- None prior for this change. Upstream design lives in `context/archive/2026-06-06-expose-cli-note-api/{plan.md,change.md,USAGE.md}`.
