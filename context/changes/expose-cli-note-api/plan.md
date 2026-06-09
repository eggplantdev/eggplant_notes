# Expose a CLI/agent HTTP API (notes + cards + reads) via personal API tokens — Implementation Plan

## Overview

Give a CLI / agent the ability to **read** a user's structure (subjects, notes) and **write** notes and memory cards over HTTP, authenticated by a personal API token (GitHub-PAT model). The ownership wall stays in the database (RLS) — the API never uses the service-role key. A token is resolved to a `user_id` through one `SECURITY DEFINER` lookup, then a short-lived user-scoped JWT is minted so every read/write runs as that user under existing RLS policies.

## Current State Analysis

- **No HTTP write/read API for app data exists.** All note/card creation is Server Actions: `create-note.ts`, `create-cards-for-note.ts`, `create-standalone-card.ts`. They build a cookie-based client via `createClient()` (`src/lib/supabase/server.ts`) and finish with `revalidatePath` + `toastRedirect` — both request/UI-scoped and unusable from a token-authed route.
- **The repo already keeps RLS as the ownership wall.** `create_note_with_checks` is `SECURITY INVOKER`, `set search_path = ''`, reads jsonb fields explicitly (never `jsonb_populate_record`), grants to `authenticated` only; `user_id default auth.uid()` + RLS `with check` block spoofing. There is **no service-role client anywhere**.
- **Existing route handlers** (`src/app/api/openrouter/callback/route.ts`, `src/app/api/auth/confirm/route.ts`) use `redirect()`; an API route should instead return `NextResponse.json` with status codes.
- **Env validation** is a Zod schema in `src/lib/env.ts` (only `NEXT_PUBLIC_*` today). Secret-at-rest precedent: `src/lib/crypto/aes-gcm.ts` reads `OPENROUTER_ENC_KEY`.
- **No rate-limiting utility or dependency** exists.
- **Read queries** live in `src/features/subjects/queries.ts` and `src/features/notes/queries.ts` (cookie-client based).
- **Test precedent**: unit tests are pure Zod (`src/__tests__/notes-schema.test.ts`); RLS isolation is proven in this repo with a two-user supabase-js client built via `createClient(url, anonKey)` + `signInWithPassword` (lessons §"signInWithPassword", §"two-user").

### Key Discoveries

- supabase-js accepts a self-signed JWT via the **`accessToken: async () => jwt`** option; required claims `sub` (user_id), `role: 'authenticated'`, `aud`, `iss`, `exp` (Context7: `/supabase/supabase` auth/jwts + signing-keys).
- Both signing regimes support hand-signed tokens: **legacy = HS256 with the shared JWT secret** (local stack + legacy hosted), asymmetric = ES256 with a generated key. Hosted regime is a deploy-time key choice, not an architecture fork.
- `cardWithSubjectSchema` (`memory-cards/schemas.ts:29`) = `memoryCardInputSchema` + nullable `subject_id`; `createStandaloneCard` inserts with `note_id: null` via `runTableAction`. `noteIdSchema`/`memoryCardIdSchema` are `z.guid()` (shape-only — lessons §"z.guid() not z.uuid()").
- `createNote` computes `position = hasSubject ? Date.now() : null` before the RPC — this is real logic that must not diverge between the UI path and the API path.

## Desired End State

A user mints a token via SQL (Phase 1), puts it in `Authorization: Bearer <token>`, and:

- `GET /api/subjects` → `{ subjects: [{ id, title }] }`, only the caller's.
- `GET /api/notes?subject=<id>` → `{ notes: [{ id, title, subject_id }] }`, only the caller's, optional filter.
- `POST /api/notes` → creates a note (+ optional cards), returns `201 { id }`.
- `POST /api/memory-cards` → creates card(s): `note_id` in body attaches to a note, `subject_id` creates a standalone card; returns `201 { ids }`.

Verify: a token for user A can never read or write user B's rows; a `user_id` placed in any request body is ignored; an expired/revoked token returns `401`.

## What We're NOT Doing

- **No token-management UI** (mint/revoke from Settings) — Phase 2, tokens minted via SQL/curl.
- **No scope enforcement** — the `scopes` column is stored but not checked this pass.
- **No rate limiting infrastructure** (Upstash/Redis/DB counters) — deferred to Phase 2; Phase 1 relies on short token expiry, a non-enumerable SHA-256 hash, and Supabase's own limits.
- **No service-role key** in the app.
- **No note-body reads** (`GET /api/notes/[id]` returning content) — titles-only this pass; add later if the agent needs bodies.
- **No pagination** on the read endpoints — capped result sets at MVP scale.
- **No update/delete endpoints** — create + read only.
- **No programmatic token issuance** (agent-fetches-token). Manual copy-once stays for Phase 1. Parked for Phase 2: a `gh`-style **device/OAuth authorization flow** (browser approval → agent polls → receives token) — the secure "no manual copy" path. Rejected outright: an agent POSTing email+password to a mint endpoint (= the password-in-config model `change.md` already rejected, strictly worse). Token issuance/delivery is **orthogonal** to the auth pipeline, so the device flow slots on later without reworking the table/lookup/JWT/endpoints.

## Implementation Approach

Build the security pipeline **once** in Phase 1 (table + DEFINER lookup + token helpers + JWT mint + JWT-scoped client factory + the route-auth helper), gated by the cross-tenant isolation test. Phase 2 adds the four thin endpoints that all ride that pipeline and reuse extracted insert cores / direct RLS-scoped selects.

The write actions are refactored so their **core** accepts an injectable `SupabaseClient` (lessons §19 corollary): the existing Server Actions keep their cookie client + `revalidatePath`/`toastRedirect`, but delegate the actual insert to a shared core the route also calls with the JWT-scoped client. One source of truth for `position`/RPC; no UI behavior change.

## Critical Implementation Details

- **The route cannot call the Server Actions directly.** They use the cookie client and `revalidatePath`/`toastRedirect` (redirect throws). Extract the insert core (validate + `position` + `rpc('create_note_with_checks')`; the `createCardsForNote` insert; the standalone insert) into client-injectable functions reused by both paths.
- **JWT claims must be verified empirically against the local stack** before trusting them (lessons §"verify-against-reality"). Mint a token, hit a protected PostgREST read, confirm `auth.uid()` resolves. Pin the exact claim set (`sub`, `role`, `aud: 'authenticated'`, `iss`, `iat`, short `exp`) only after the round-trip succeeds.
- **`resolve_api_token` is the only elevated surface** — `SECURITY DEFINER`, `set search_path = ''`, granted to `anon` (the request is unauthenticated when it runs). It must: reject revoked (`revoked_at is not null`) and expired (`expires_at < now()`) tokens, bump `last_used_at`, and return `user_id` or null. It returns a uuid only to a caller already holding the correct token hash — not enumerable.
- **Token is hashed in app code** (Node `crypto` SHA-256), never sent raw to SQL beyond the hash; store only the hash.
- **Untrusted-input validation (HTTP-specific — differs from the Server Action paths):**
  - `await req.json()` **throws** on malformed/empty/non-JSON bodies — wrap it and return `400`, never let it 500. Same for an absent body on POST.
  - After parsing, run the existing Zod schemas via `validateInput` (reuse `createNoteWithChecksSchema`; the discriminated memory-cards body; `?subject` as `z.guid()`). The schema caps (≤50 checks, ≤20 cards, ≤2000-char prompt) are the input bounds.
  - **Body size**: rely on the Vercel function body limit (~4.5MB) + the schema caps — no hand-rolled size guard this pass (explicit decision; revisit if the surface is widely exposed).
  - **Spoofing is defended twice**: schemas don't accept `user_id`, and the RPC reads jsonb fields explicitly (never `jsonb_populate_record`) — a body `user_id` is stripped at the schema AND ignored at the DB. Keep schemas lenient (Zod strips unknown fields); the explicit-read RPC is the real guard.
  - A malformed `Authorization` header (missing/!`Bearer `) returns `401` from `authenticateRequest`, not `400`.
- **Do NOT sanitize note/card content on input.** SQL injection is impossible (parameterized supabase-js/PostgREST/jsonb RPC). XSS is an _output_ concern already handled: the render path (`src/components/markdown/render-markdown.tsx:8`) is `react-markdown` + `@shikijs/rehype` with **no `rehype-raw`**, so raw HTML in a body stays escaped. Content is markdown for a _coding_ app — bodies legitimately contain `<script>`, HTML, SQL, shell; an input sanitizer would corrupt real data. Principle: validate + bound on input (Zod), store raw, escape on output. Only normalization is trimming (already done by `trimmedString`/`optionalText`). **Tripwire**: this API now stores externally-supplied content, so the no-`rehype-raw` property is load-bearing — if anyone later adds raw-HTML rendering to notes, this turns self-XSS into stored-XSS; gate any such change on re-adding sanitization at the render layer.

---

## Phase 1: Auth core (the load-bearing security surface)

### Overview

Everything needed to turn a Bearer token into an RLS-scoped supabase-js client, plus the migration and the isolation test. No HTTP endpoints yet — Phase 1 is provable in tests.

### Changes Required:

#### 1. `api_tokens` table + `resolve_api_token` function

**File**: `supabase/migrations/<ts>_api_tokens.sql`

**Intent**: Persist token hashes scoped to a user; provide the single elevated lookup that maps a hash to a `user_id`.

**Contract**: Table `public.api_tokens (id uuid pk default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade, token_hash text not null unique, name text not null, scopes text[] not null default '{}', expires_at timestamptz, last_used_at timestamptz, revoked_at timestamptz, created_at timestamptz default now())`. RLS on; owner-only `select`/`update` (`user_id = auth.uid()`) so a future UI can list/revoke; no client `insert` policy (SQL-minted in Phase 1). Add the `moddatetime` trigger only if an `updated_at` column is added (not required here — append/lookup-bump only). Function:

```sql
create or replace function public.resolve_api_token(p_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid;
begin
  update public.api_tokens
     set last_used_at = now()
   where token_hash = p_hash
     and revoked_at is null
     and (expires_at is null or expires_at > now())
  returning user_id into v_user_id;
  return v_user_id; -- null when no live token matches
end; $$;
revoke execute on function public.resolve_api_token(text) from public;
grant execute on function public.resolve_api_token(text) to anon, authenticated;
```

#### 2. Token helpers (generate + hash)

**File**: `src/features/api-tokens/token.ts`

**Intent**: Create a `clc_`-prefixed 256-bit random token and a deterministic hash for storage/lookup.

**Contract**: `generateToken(): { raw: string; hash: string }` — `raw = 'clc_' + base64url(randomBytes(32))`; `hash = sha256hex(raw)`. `hashToken(raw: string): string`. Pure, unit-testable (Node `crypto`, no Supabase).

#### 3. JWT mint

**File**: `src/lib/auth/mint-user-jwt.ts`

**Intent**: Mint a short-lived user-scoped JWT the Supabase API accepts.

**Contract**: `mintUserJwt(userId: string): Promise<string>` using `jose` `SignJWT`, HS256 over `SUPABASE_JWT_SECRET`. Claims pinned after empirical verification (see Critical Details). Short `exp` (≤ a few minutes). Add `jose` dependency. Confine the secret read to `src/lib/env.ts`.

#### 4. Env var

**File**: `src/lib/env.ts`

**Intent**: Add the signing secret as a validated server-only var.

**Contract**: `SUPABASE_JWT_SECRET: z.string().min(1)` (server-only, no `NEXT_PUBLIC_`). Add to `.env.local` (local well-known secret) and to Vercel (prod/preview) — confirm the hosted signing regime first; if asymmetric, store the generated private key instead and switch the mint to ES256.

#### 5. JWT-scoped Supabase client factory

**File**: `src/lib/supabase/from-access-token.ts`

**Intent**: Build a request-scoped supabase-js client that runs every query as the token's user.

**Contract**: `clientForAccessToken(jwt: string): SupabaseClient<Database>` — plain `@supabase/supabase-js` `createClient(url, anonKey, { accessToken: async () => jwt })`. No cookies. This is NOT elevated (user-scoped); the elevation lives only in `resolve_api_token`.

#### 6. Route auth pipeline

**File**: `src/features/api-tokens/authenticate-request.ts`

**Intent**: One function every route calls to go from request → authenticated client.

**Contract**: `authenticateRequest(req): Promise<{ supabase, userId } | { error: NextResponse }>` — parse `Authorization: Bearer`, `hashToken`, call `rpc('resolve_api_token')` via an anon client, `401` on null, `mintUserJwt`, return `clientForAccessToken`. Centralizes the 401 envelope.

#### 7. Injectable insert cores

**Files**: `src/features/notes/actions/create-note.ts`, `src/features/memory-cards/actions/create-cards-for-note.ts`, `src/features/memory-cards/actions/create-standalone-card.ts` (+ a small shared core module if cleaner).

**Intent**: Extract the DB-write core so both the cookie action and the API route share it.

**Contract**: A core fn per write that takes `(supabase, parsedData)` and returns `{ id }` / `{ ids }` (or throws). Existing actions keep validating, call the core with their cookie client, then `revalidatePath`/`toastRedirect`. No change to UI behavior, schemas, or the `position` rule.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `supabase db reset` (or `supabase migration up`) succeeds
- Type checking passes: `pnpm exec next typegen && pnpm typecheck`
- Linting passes: `pnpm exec eslint <changed files>`
- Token helper unit tests pass: `pnpm test` (generate/hash round-trip; hash is deterministic; `clc_` prefix; 256-bit length)
- **Isolation integration test passes** (the gate): with the local stack up, mint tokens for two real users A and B; assert (a) A's pipeline can write a note and read it back; (b) A cannot read B's subjects/notes; (c) a `user_id` placed in the request body is ignored (row lands under A); (d) an expired and a revoked token both 401

#### Manual Verification:

- `curl` a minted token through `authenticateRequest` (via a temporary throwaway route or a script) and confirm `auth.uid()` resolves to the right user against a protected PostgREST read
- Confirm `SUPABASE_JWT_SECRET` is present locally and the minted JWT is accepted by the local stack

**Implementation Note**: After Phase 1 automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: The four endpoints + mint docs

### Overview

Thin routes over the Phase-1 pipeline; each reuses an extracted core or a direct RLS-scoped select. Plus a short doc on minting a token by SQL and example `curl`s.

### Changes Required:

#### 1. `POST /api/notes`

**File**: `src/app/api/notes/route.ts`

**Intent**: Create a note + optional cards for the token's user.

**Contract**: `authenticateRequest` → validate body with `createNoteWithChecksSchema` → call the extracted note-core with the JWT client → `201 { id }`; `400` on validation, `401` on auth.

#### 2. `POST /api/memory-cards`

**File**: `src/app/api/memory-cards/route.ts`

**Intent**: Create card(s), attached to a note or standalone.

**Contract**: Discriminated Zod body in `src/features/api-tokens/schemas.ts` (or `memory-cards/schemas.ts`): `{ note_id: guid, cards: [...] }` → cards-for-note core; `{ subject_id: guid|null, ...card }` (reuse `cardWithSubjectSchema`) → standalone core. Exactly one branch required. Returns `201 { ids }`.

#### 3. `GET /api/subjects`

**File**: `src/app/api/subjects/route.ts`

**Intent**: List the caller's subjects so the agent can choose/create one.

**Contract**: `authenticateRequest` → `supabase.from('subjects').select('id,title')` (RLS-scoped) → `{ subjects }`. Capped, no pagination.

#### 4. `GET /api/notes`

**File**: `src/app/api/notes/route.ts` (GET handler alongside POST)

**Intent**: List the caller's notes (titles), optional subject filter.

**Contract**: `authenticateRequest` → `select('id,title,subject_id')`, `.eq('subject_id', q)` when `?subject=` present and a valid guid → `{ notes }`.

#### 5. Mint docs

**File**: `context/changes/expose-cli-note-api/USAGE.md` (or append to the change folder)

**Intent**: Record the SQL to mint a token (hash a `clc_…` value and insert) and `curl` examples for all four endpoints.

**Contract**: Plain doc — the raw token is shown once by the minting operator; only the hash is inserted.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec next typegen && pnpm typecheck`
- Linting passes: `pnpm exec eslint <changed files>`
- Production build succeeds: `pnpm build`
- Route-level integration tests pass: POST note → 201; POST card (both modes) → 201; GET subjects/notes return only the caller's rows; missing/garbage token → 401; malformed body → 400

#### Manual Verification:

- Full `curl` walkthrough with a real minted token: `GET /api/subjects` → `POST /api/notes` → `GET /api/notes` shows it → `POST /api/memory-cards` (note_id) → `POST /api/memory-cards` (subject_id), each returning the expected row in the UI
- A second user's token sees none of the first user's data

**Implementation Note**: After Phase 2, run the slice-review-gate (review → simplify → tests → archive) per the project's per-change gate.

---

## Testing Strategy

### Unit Tests:

- Token generate/hash (prefix, length, determinism, raw≠hash)
- Discriminated memory-cards body schema (exactly-one-branch; rejects both/neither)

### Integration Tests (local Supabase, two real users — the load-bearing layer):

- Cross-tenant read isolation (A cannot see B)
- Cross-tenant write isolation + body `user_id` ignored (the spoofing gate)
- Expired token → 401; revoked token → 401
- Note+cards create; both card modes; subject/notes reads scoped

### Manual Testing Steps:

1. Mint a token by SQL; `curl` each endpoint with `Authorization: Bearer`.
2. Confirm created rows appear under the right account in the UI.
3. Repeat reads with a second user's token; confirm isolation.

## Performance Considerations

Each request: one `resolve_api_token` round-trip + one JWT sign (cheap, HS256) + the actual query. No N+1. Reads are capped, no pagination at MVP scale.

## Migration Notes

`api_tokens` is additive. The `resolve_api_token` grant to `anon` is intentional and safe (returns a uuid only to a holder of the correct hash). No data backfill. Hosted deploy must add `SUPABASE_JWT_SECRET` (or the asymmetric key) before the route works in prod/preview.

## References

- Change identity + settled deviations: `context/changes/expose-cli-note-api/change.md`
- Existing actions: `src/features/notes/actions/create-note.ts`, `src/features/memory-cards/actions/create-cards-for-note.ts`, `src/features/memory-cards/actions/create-standalone-card.ts`
- RPC pattern: `supabase/migrations/20260608190844_create_note_with_checks_subject_title.sql`, `…20260607151500_import_notes_rpc.sql`
- Supabase JWT/accessToken: Context7 `/supabase/supabase` — auth/jwts, auth/signing-keys
- Lessons: §19 (injectable client + two-user isolation), §"z.guid() not z.uuid()", §"verify against reality", §"pg_catalog not information_schema"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Auth core

#### Automated

- [x] 1.1 Migration applies cleanly (`supabase db reset`/`migration up`) — cf1a5a5
- [x] 1.2 Type checking passes (`next typegen && typecheck`) — cf1a5a5
- [x] 1.3 Linting passes (eslint on changed files) — cf1a5a5
- [x] 1.4 Token helper unit tests pass — cf1a5a5
- [x] 1.5 Isolation integration test passes (read + write isolation, body user_id ignored, expired+revoked → 401) — cf1a5a5

#### Manual

- [x] 1.6 Minted token resolves auth.uid() against a protected read (covered by the integration test) — cf1a5a5
- [x] 1.7 SUPABASE_JWT_SECRET present locally; minted JWT accepted by the local stack — cf1a5a5

### Phase 2: Endpoints + mint docs

#### Automated

- [x] 2.1 Type checking passes (`next typegen && typecheck`)
- [x] 2.2 Linting passes (eslint on changed files)
- [x] 2.3 Production build succeeds (`pnpm build`)
- [x] 2.4 Route integration tests pass (POST note/cards → 201; GET scoped; 401/400 paths)

#### Manual

- [x] 2.5 Full curl walkthrough creates rows under the right account (covered by route integration tests)
- [x] 2.6 Second user's token sees none of the first user's data (covered by route + pipeline integration tests)
