# CLI Token Management UI + Downloadable Agent Skill — Implementation Plan

## Overview

Finish Phase 2 of `expose-cli-note-api`: give users a **Settings → CLI Tokens** section to mint (copy-once), list, and revoke personal API tokens without SQL, plus a **session-gated "Download agent skill"** that serves the `clc-note-api` skill with the deployment's own origin injected as `BASE`. This is what makes the merged HTTP API actually usable by a real, non-owner user.

## Current State Analysis

The auth/data backend shipped and merged in Phase 1 — this slice is UI + two Server Actions + one route. Key facts (full grounding in `research.md`):

- `api_tokens` table + RLS are live (`supabase/migrations/20260609120000_api_tokens.sql`). RLS includes `api_tokens_insert_own` / `select_own` / `update_own`, all `to authenticated`, pinned to `auth.uid()`. **No service-role, no DEFINER mint RPC** — mint/list/revoke run under the user's own cookie-session client.
- No delete policy: **revoke = `update revoked_at`** (audit trail).
- `generateToken(): { raw, hash }` exists (`src/features/api-tokens/token.ts:7-10`); only the hash is stored.
- Settings patterns to reuse: `settings/page.tsx` (async server component, `Promise.all` of queries, `<SettingsSection>` blocks), `daily-goal-form.tsx` (`useAppForm` + `useFormError`), `update-daily-goal.ts` (`getCurrentUser` → write → `revalidatePath`), `disconnect.ts` (revoke template), `useActionTransition`/`DeleteButton` (button action), `contact-dialog.tsx` (form-in-Dialog), `connect.ts:12-17` (origin from `host` header).
- The skill artifact already exists at `context/changes/cli-token-ui-and-skill-download/clc-note-api.skill.md` with a `{{CLC_BASE_URL}}` placeholder (`:23`).

## Desired End State

A logged-in user opens Settings, mints a named token, sees the raw value once in a modal with a Copy button, downloads the agent skill (which now contains the production URL), and pastes the token into it. They can see their active tokens (name, created, last-used) and revoke any. Verify: minting shows the raw token exactly once; revoking makes that token 401 against `/api/*`; the downloaded skill's `BASE=` line equals the deployment origin; an unauthenticated request to the download route is rejected.

### Key Discoveries:

- `api_tokens_insert_own` RLS exists (`supabase/migrations/20260609120000_api_tokens.sql:28-29`) → direct insert, no elevation.
- `ActionResultT` (`src/types/action.ts:1`) carries no payload → the mint action must widen it to return `rawToken`. `toastActionResult`/`reportResult` read only `.success`/`.error`, so a wider success shape flows through unchanged (`src/components/forms/hooks/use-form-error.ts`).
- Zero clipboard / reveal-once precedent in the repo → the show-once modal is built fresh from `src/components/ui/dialog.tsx`, `input.tsx`, `button.tsx`, `src/components/toasts.ts:11`.
- Origin-from-`host` pattern at `src/features/openrouter/actions/connect.ts:12-17` (handles localhost-http + preview deploys) — reuse for the download route.

## What We're NOT Doing

- No token **expiry** UI — tokens are non-expiring in v1; revoke is the lifecycle control (`expires_at` stays null). The column remains for later.
- No **scope** picker — `scopes` stays stored-not-enforced (Phase 1 decision).
- No **device/OAuth authorization flow** (the `gh`-style auto-issuance) — still parked.
- No **rate limiting**.
- No **revoked-token display** — the list shows active tokens only (revoked rows persist as audit but aren't rendered).
- No new **migration** — the table already exists.
- No **token regeneration/rotation** UI — mint a new one + revoke the old.

## Implementation Approach

Two vertical phases. Phase 1 delivers the full token lifecycle in Settings (mint → copy-once → list → revoke), each piece mirroring an existing Settings/credential pattern; the only net-new UI is the reveal modal. Phase 2 delivers the downloadable skill: the change-folder `.md` is mirrored into a bundled TS string constant (Vercel-safe), served by a session-gated route that injects the request origin.

## Critical Implementation Details

- **Mint returns a secret, so it can't use `runTableAction`.** The mint action generates the token in app code and returns the raw value, which never comes from the DB. Do the insert directly under the cookie client and return `{ success: true, rawToken }`; don't route it through the `runTableAction` helper (which returns DB rows). The raw token must live only in the action's return value and client state — never persisted, never re-fetchable.
- **Template drift.** The servable TS constant and the human-readable `.md` are two copies of the same content. Keep the `.md` as the readable source and mirror it into the constant; a unit test pins that the constant contains the `{{CLC_BASE_URL}}` token and the expected endpoints so silent drift fails CI.

## Phase 1: CLI Tokens Settings section

### Overview

Mint / list / revoke personal tokens in a new Settings section, with a one-time reveal modal for the raw token.

### Changes Required:

#### 1. List query

**File**: `src/features/api-tokens/queries.ts` (new)

**Intent**: Fetch the current user's active tokens for the Settings list.

**Contract**: `getApiTokens(): Promise<ApiTokenListItemT[]>` — server-only, RLS-scoped `createClient()`; `select('id,name,created_at,last_used_at').is('revoked_at', null).order('created_at', { ascending: false })`. Row type `ApiTokenListItemT` in `src/types/` or a local type per project convention.

#### 2. Token-name schema

**File**: `src/features/api-tokens/schemas.ts` (extend; currently holds the route-body `noteAttachCardsSchema`)

**Intent**: Validate the mint form's `name` field and the action input.

**Contract**: Following the repo's field-vs-action split (daily-goal precedent): `tokenNameFieldSchema` (a `trimmedString('Name', N)` for the TanStack field validator) + `mintTokenSchema` (`{ name }` for the action contract). Add a `TOKEN_NAME_MAX_LENGTH` const if useful. Name the exports so they're not confused with the existing route-body schema.

#### 3. Mint action

**File**: `src/features/api-tokens/actions/mint-api-token.ts` (new)

**Intent**: Create a token for the current user and return the raw value once.

**Contract**: `'use server'`; `getCurrentUser()` guard → `validateInput(mintTokenSchema, input)` → `generateToken()` → `createClient().from('api_tokens').insert({ name, token_hash: hash })` (user_id defaults to `auth.uid()`) → `revalidatePath('/settings')` → returns `{ success: true; rawToken: string } | { success: false; error: string }`. Does NOT use `runTableAction`. Never logs the raw token or hash.

#### 4. Revoke action

**File**: `src/features/api-tokens/actions/revoke-api-token.ts` (new)

**Intent**: Revoke one token (soft, audit-preserving).

**Contract**: `'use server'`; mirror `openrouter/actions/disconnect.ts:10-24`. `getCurrentUser()` guard → `createClient().from('api_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', tokenId)` (RLS scopes to owner) → `revalidatePath('/settings')` → `ActionResultT`.

#### 5. Show-once + copy modal

**File**: `src/features/api-tokens/components/token-reveal-dialog.tsx` (new)

**Intent**: Display the freshly-minted raw token exactly once with a one-click copy, making clear it won't be shown again.

**Contract**: `'use client'`; controlled `Dialog` (`src/components/ui/dialog.tsx`) opened when mint succeeds. Read-only `Input` showing the raw token; a Copy button → `navigator.clipboard.writeText(raw)` + `toastMessage('Copied', 'success')` (`src/components/toasts.ts:11`); copy explaining it's shown only once. Closing clears the value from state.

#### 6. Mint form

**File**: `src/features/api-tokens/components/mint-token-form.tsx` (new)

**Intent**: Name + create a token; on success, open the reveal modal.

**Contract**: `'use client'`; `useAppForm` (mirror `daily-goal-form.tsx` / `contact-dialog.tsx`) with a `name` field validated by `tokenNameFieldSchema`; submit calls `mintApiToken`; on `result.success` capture `result.rawToken` into state and open `TokenRevealDialog`; on failure show inline `FormError`. Pending via `<form.Subscribe selector={s => s.isSubmitting}>`.

#### 7. Tokens list + revoke button

**File**: `src/features/api-tokens/components/api-tokens-list.tsx` (new) — and a per-row revoke control

**Intent**: Show active tokens and let the user revoke one (with confirmation).

**Contract**: Renders `name`, `created_at`, `last_used_at` (empty-state when none). Per-row revoke: a client control using `useActionTransition` (mirror `sample-data-section.tsx`) calling `revokeApiToken(id)`, gated behind a confirm dialog (reuse the confirm primitive `DeleteButton` wraps, labelled "Revoke"). `isPending` disables the row's button.

#### 8. Section assembly + page wiring

**Files**: `src/features/api-tokens/components/api-tokens-section.tsx` (new), `src/app/(protected)/settings/page.tsx` (modify)

**Intent**: Compose the section and mount it on the Settings page.

**Contract**: `api-tokens-section.tsx` arranges the mint form + list (+ the Phase-2 download button later). In `settings/page.tsx`, add `getApiTokens()` to the `Promise.all` (`:11`) and render `<SettingsSection title="CLI Tokens" description=…>` wrapping `<ApiTokensSection tokens={tokens} />`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec next typegen && pnpm typecheck`
- Linting passes: `pnpm exec eslint <changed files>`
- Production build succeeds: `pnpm build`
- Unit test for `mintTokenSchema` / `tokenNameFieldSchema` passes: `pnpm test`

#### Manual Verification:

- Mint a token → the raw value appears once in the modal; Copy works; closing and re-opening never shows it again
- The new token appears in the list with name + created; `last_used_at` populates after one `/api/*` call with it
- Revoke a token → it disappears from the list, and a subsequent `/api/*` call with it returns 401
- A second account sees none of the first account's tokens

**Implementation Note**: After Phase 1 automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Downloadable agent skill

### Overview

Serve the `clc-note-api` skill from Settings with the deployment origin injected, gated to logged-in users.

### Changes Required:

#### 1. Servable skill template constant

**File**: `src/features/api-tokens/skill-template.ts` (new)

**Intent**: Ship the skill markdown inside the bundle so the route can read it without filesystem/cwd risk on Vercel.

**Contract**: Export a `CLC_SKILL_TEMPLATE` string = the contents of `context/changes/cli-token-ui-and-skill-download/clc-note-api.skill.md`, verbatim, retaining the `{{CLC_BASE_URL}}` placeholder. The `.md` stays the readable source of truth; this constant mirrors it.

#### 2. Origin helper (reuse or extract)

**File**: reuse `src/features/openrouter/actions/connect.ts:12-17` logic, optionally extracting `src/lib/request-origin.ts`

**Intent**: Derive the deployment origin (prod/preview/local) from the request.

**Contract**: `host` header → proto inference (`localhost`/`127.0.0.1` → http, else https) → `${proto}://${host}`, falling back to `SITE_URL` (`src/lib/env.ts:22`). If both this route and `connect.ts` use it, extract a shared helper; otherwise inline.

#### 3. Download route

**File**: `src/app/api/skill/route.ts` (new)

**Intent**: Serve the skill as a downloadable file with `BASE` injected, only to authenticated users.

**Contract**: `export async function GET(request)`. Session-gate via the cookie client (`getCurrentUser()`); return 401 (`errorJson`) when absent. Compute origin (helper above), `CLC_SKILL_TEMPLATE.replace('{{CLC_BASE_URL}}', origin)`, return `new NextResponse(filled, { status: 200, headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="clc-note-api.skill.md"' } })`.

#### 4. Download button

**File**: `src/features/api-tokens/components/api-tokens-section.tsx` (modify)

**Intent**: Let the user download the skill from the CLI Tokens section.

**Contract**: A "Download agent skill" control linking to `/api/skill` (an `<a href="/api/skill" download>` styled as a button works — the browser sends the session cookie). Short helper copy: download it, drop it in your agent, paste a token above.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec next typegen && pnpm typecheck`
- Linting passes: `pnpm exec eslint <changed files>`
- Production build succeeds: `pnpm build`
- Unit test passes: `CLC_SKILL_TEMPLATE` contains `{{CLC_BASE_URL}}` and the three endpoints (drift guard); the injection replaces the placeholder with a given origin: `pnpm test`

#### Manual Verification:

- Logged in, click Download → a `clc-note-api.skill.md` downloads whose `BASE=` line equals the app origin (prod URL on prod, preview URL on a preview deploy)
- An unauthenticated request to `/api/skill` returns 401
- End-to-end: download the skill, paste a minted token, run its smoke test against the deployment → a note + cards appear under the right account

**Implementation Note**: After Phase 2, run the slice-review-gate (review → simplify → tests → archive) per the project's per-change gate.

---

## Testing Strategy

### Unit Tests:

- `tokenNameFieldSchema` / `mintTokenSchema` (accepts a valid name; rejects empty/over-length)
- Skill template: contains `{{CLC_BASE_URL}}` + the documented endpoints; `.replace` injects a supplied origin (drift + injection guard)

### Integration Tests (optional, local Supabase):

- Mint inserts a row scoped to the caller; revoke flips `revoked_at`; a revoked token 401s through `authenticateRequest` (extends the existing api-tokens integration suite)

### Manual Testing Steps:

1. Settings → CLI Tokens → mint "cli" → copy the raw token from the modal.
2. Confirm it lists with name/created; revoke it; confirm it's gone and 401s against `/api/subjects`.
3. Download the skill; confirm `BASE=` is the deployment origin; paste a fresh token; run the smoke test; confirm rows land under the account.
4. Hit `/api/skill` logged out → 401.

## Performance Considerations

Negligible — one extra RLS-scoped select on the Settings page; the download route does one in-memory string replace. No new queries on the hot path.

## Migration Notes

None — `api_tokens` already exists. Hosted prod/preview still need `SUPABASE_JWT_SECRET` (or the asymmetric key) for the `/api/*` routes themselves, per the Phase-1 migration notes — independent of this UI.

## References

- Research: `context/changes/cli-token-ui-and-skill-download/research.md`
- Skill artifact (template source): `context/changes/cli-token-ui-and-skill-download/clc-note-api.skill.md`
- Phase-1 design: `context/archive/2026-06-06-expose-cli-note-api/{plan.md,change.md}`
- Patterns: `src/features/settings/components/daily-goal-form.tsx`, `src/features/openrouter/actions/{disconnect,connect}.ts`, `src/features/contact/components/contact-dialog.tsx`, `src/features/api-tokens/token.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: CLI Tokens Settings section

#### Automated

- [x] 1.1 Type checking passes (`next typegen && typecheck`)
- [x] 1.2 Linting passes (eslint on changed files)
- [x] 1.3 Production build succeeds (`pnpm build`)
- [x] 1.4 Unit test for token-name/mint schema passes

#### Manual

- [x] 1.5 Mint shows the raw token once; Copy works; never re-shown
- [x] 1.6 Token lists with name/created; last_used_at populates after an API call
- [x] 1.7 Revoke removes it from the list and the token 401s against `/api/*`
- [x] 1.8 A second account sees none of the first account's tokens

### Phase 2: Downloadable agent skill

#### Automated

- [ ] 2.1 Type checking passes (`next typegen && typecheck`)
- [ ] 2.2 Linting passes (eslint on changed files)
- [ ] 2.3 Production build succeeds (`pnpm build`)
- [ ] 2.4 Unit test: template drift + origin-injection guard passes

#### Manual

- [ ] 2.5 Download yields a skill whose `BASE=` is the deployment origin
- [ ] 2.6 Unauthenticated `/api/skill` returns 401
- [ ] 2.7 End-to-end: downloaded skill + pasted token creates rows under the right account
