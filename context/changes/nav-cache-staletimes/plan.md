# Navigation cache via `staleTimes` + mutation busting — Implementation Plan

## Overview

Enable the client Router Cache for dynamic routes by setting `experimental.staleTimes.dynamic = 300` in `next.config.ts`, so repeat navigation between authed pages is served from in-browser memory instead of a fresh server round-trip. Because enabling that cache makes stale data possible after a write, every mutation surface must bust it. Ship in two phases: **Phase 1** = config + a uniform nuclear bust (`revalidatePath('/', 'layout')`) at every mutation surface (correctness-first, shippable alone); **Phase 2** = replace the nuclear bust with per-domain path sets that evict only the routes that display the changed data.

## Current State Analysis

- Dynamic (cookie-bound) authed pages render fresh on every soft-nav: `staleTimes.dynamic` defaults to **0**, so the client Router Cache never reuses them (`next.config.ts` has no `staleTimes`).
- **The existing `revalidatePath` calls scattered across Server Actions are currently no-ops** (`lessons.md:219`): with `dynamic = 0` there is no client cache to bust, supabase-js reads aren't in the Data Cache, and dynamic routes aren't in the Full Route Cache. They become load-bearing only once the client cache is enabled.
- Mutation logic for notes/memory-cards/subjects lives in shared `*-core.ts` modules consumed by **both** Server Actions and token-API route handlers (`src/features/{notes,subjects,memory-cards}/*-core.ts`). Those cores are unit-tested directly with **no request scope and no `next/cache` mock** (`src/__tests__/update-cores.test.ts`, `subject-cores.test.ts`).
- The token HTTP API exposes 6 mutating route files (POST/PATCH/DELETE on `notes`, `notes/[id]`, `memory-cards`, `memory-cards/[id]`, `subjects`, `subjects/[id]`).
- Three cross-cutting reads (`getSubjects`, `getDailyGoal`, `getOpenRouterStatus`) appear on many routes but are evicted on only their home route — the Phase 2 gap map (see `design.md`).

## Desired End State

Navigating back and forth between authed pages within 5 minutes is instant (no server round-trip). Any in-app mutation immediately drops the cache so the next navigation shows fresh data. Any token-API mutation resets the server caches so the next request (from any session) is fresh; an already-open browser tab converges within the 5-minute window. Verified by E2E: mutate → navigate → fresh DOM, and read→read → no refetch.

### Key Discoveries:

- `revalidatePath('/', 'layout')` invalidates the root layout and cascades to the entire route tree — the framework's purge-everything switch, no wrapper needed (`node_modules/next/dist/docs/.../revalidatePath.md`).
- `revalidatePath` is callable in Server Actions **and** Route Handlers, but a Route Handler call only _marks_ paths (applied on next visit) — it cannot push into a live browser tab. Cross-actor freshness is therefore bounded by `staleTimes.dynamic` (accepted; design.md "Key limitation").
- A Server Action that `redirect()`s throws on the redirect, so `revalidatePath` must run **before** `redirect()`. Affected: `sign-in`, `sign-out`, `sign-up`, `openrouter/connect` (and `delete-account` if it redirects).
- E2E harness constraints from `lessons.md`: fresh prod server only (`reuseExistingServer: false`, port 3100, `NEXT_DIST_DIR=.next-e2e`), `retries: 2`, fresh per-test sign-up for mutation specs, `getByTestId` locators.

## What We're NOT Doing

- No server-side data caching of per-user reads (`'use cache'`/`unstable_cache`) — still blocked by RLS.
- No `revalidateTag` — requires server-cached + tagged data we don't have for per-user reads.
- No bust inside `*-core.ts` — would break the request-scope-free core unit tests.
- No wrapper around `revalidatePath('/', 'layout')` in Phase 1 — it would only alias one framework call.
- Not changing `staleTimes.static` (stays at its 5-min default).
- Not touching read-only actions (`get-notes-for-linking`, `list-models`, `list-favorite-models`) or `contact/send-contact-message` (renders no cached data).

## Implementation Approach

Phase 1 makes the system correct with the least code: one config line + one identical bust call at each mutation surface, replacing the now-dead scattered `revalidatePath` calls. Phase 2 is a pure refinement — swap the nuclear call for per-domain functions that bundle a path list, shared by both the action and the route handler so they cannot drift, closing the gap map without ever regressing correctness.

## Critical Implementation Details

- **Config is the enabling prerequisite.** The bust calls do nothing until `staleTimes.dynamic` is non-zero. Land the config line and the busts in the same phase; do not split them across PRs.
- **Bust before redirect.** In any action that ends in `redirect()`, call `revalidatePath('/', 'layout')` before the redirect — `redirect()` throws to unwind.
- **Sample-data actions** already centralize busting via `revalidateSeedPaths()` in `src/features/sample-data/seed-rows.ts`; in Phase 1 point that helper at the nuclear bust rather than adding a second call in each action.

## Phase 1: staleTimes + nuclear bust at every surface

### Overview

Enable the client cache and guarantee no post-write staleness by nuking the whole tree on every mutation.

### Changes Required:

#### 1. Enable the client Router Cache

**File**: `next.config.ts`

**Intent**: Turn on client-side caching of dynamic routes so repeat navigation is served from browser memory.

**Contract**: Add `staleTimes: { dynamic: 300 }` under the existing `experimental` block (alongside `serverActions`). Leave `static` unset (keeps its 5-min default).

#### 2. Nuclear bust in every state-mutating Server Action

**File**: `src/features/**/actions/*.ts` (state-mutating only — see list below)

**Intent**: After the mutation succeeds, drop the entire client cache so the next navigation re-renders fresh. Replace each action's existing (currently dead) `revalidatePath(...)` call(s) with the single nuclear call; for redirecting actions, place it before `redirect()`.

**Contract**: `revalidatePath('/', 'layout')` from `next/cache`, on the success path. Surfaces:

- `account/delete-account`
- `api-tokens/mint-api-token`, `revoke-api-token`
- `auth/sign-in`, `sign-out`, `sign-up`, `update-password`, `reset-password` (bust before redirect where present)
- `import/import-notes`
- `memory-cards/create-cards-for-note`, `create-memory-card`, `create-standalone-card`, `delete-memory-card`, `link-card-to-note`, `unlink-card-from-note`, `update-memory-card`
- `notes/create-note`, `delete-note`, `update-note`
- `openrouter/connect` (before redirect), `disconnect`, `set-model`, `toggle-favorite`, `save-user-prompt`, `reset-user-prompt`, and `generate-cards`/`generate-notes` **only if they persist rows** (verify; skip if they only return text to a form)
- `review/rate-memory-card`
- `settings/update-daily-goal`
- `subjects/create-subject`, `update-subject`, `delete-subject`, `reorder-note`

#### 3. Nuclear bust in every mutating API route handler

**File**: `src/app/api/{notes,memory-cards,subjects}/route.ts` and `.../[id]/route.ts` (6 files)

**Intent**: A token-API write must reset the server caches so the next request is fresh (server-side; live tabs converge within the window). Add the bust at each POST/PATCH/DELETE handler, on the success path.

**Contract**: `revalidatePath('/', 'layout')` after the `*-core` mutation returns success. Do **not** move this into the shared core (keeps core unit tests request-scope-free).

#### 4. Point the sample-data revalidate helper at the nuclear bust

**File**: `src/features/sample-data/seed-rows.ts`

**Intent**: Keep one bust path for the seed/clear actions consistent with the rest of Phase 1.

**Contract**: `revalidateSeedPaths()` calls `revalidatePath('/', 'layout')` instead of iterating `SEED_REVALIDATE_PATHS` (the path list becomes dead in Phase 1; Phase 2 decides its fate).

#### 5. Phase 1 E2E

**File**: `e2e/nav-cache.spec.ts` (new)

**Intent**: Prove the cache is on, that an in-app write busts it, and that an API write is reflected on revisit — the latter is the sync guard for the route handlers.

**Contract**: Three specs against the fresh prod server (port 3100): (a) navigate A→B→A and assert the second visit to A issues no new RSC request (read→read cached); (b) edit a note title in-app, navigate away and back, assert the new title (write busts cache); (c) edit via the token API, revisit the path, assert fresh. Use `getByTestId` locators and fresh per-test sign-up.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec next typegen && pnpm typecheck`
- Lint passes on touched files: `pnpm exec eslint <touched files>`
- Unit suite still green (core tests unaffected): `pnpm test`
- E2E passes: `pnpm test:e2e e2e/nav-cache.spec.ts`

#### Manual Verification:

- Rapid back-and-forth between `/dashboard`, `/notes`, `/subjects` feels instant (no spinner/round-trip) on the prod build.
- Creating/editing a note in the UI shows the change immediately on the next navigation (no stale list).
- No regression: rating a card, deleting a subject, changing the daily goal all reflect on the next nav.

**Implementation Note**: After Phase 1 automated verification passes, pause for human manual confirmation before starting Phase 2.

---

## Phase 2: granular per-domain busting

### Overview

Replace the nuclear bust with per-domain path-set functions so a write evicts only the routes that display the changed data, closing the gap map. Correctness never regresses (granular is a superset of what nuclear covered for each domain).

### Changes Required:

#### 1. Per-domain revalidate modules

**File**: `src/features/subjects/revalidate.ts`, `src/features/settings/revalidate.ts`, `src/features/openrouter/revalidate.ts` (new), plus per-entity helpers for notes/memory-cards as needed.

**Intent**: One named function per data domain that busts every route displaying that domain's data, imported by both the Server Action and the route handler so the two surfaces can't drift.

**Contract**: Each exports a function iterating `revalidatePath` over the domain's consumer paths. Dynamic children use the segment form (`revalidatePath('/notes/[id]', 'page')`) or a layout sweep (`revalidatePath('/notes', 'layout')`). Path sets per the design.md gap map:

- subjects → `/subjects`, `/subjects/[id]`, `/notes`, `/memory-cards`, `/import` (+ dropdown consumers)
- daily goal → `/dashboard`, `/memory-cards`, `/memory-cards/[id]`, `/settings`
- openrouter status → `/settings`, `/import`, `/notes/new`, `/notes/[id]`, `/memory-cards/new`

#### 2. Close the per-path gaps

**File**: the mutation surfaces from Phase 1.

**Intent**: Swap each `revalidatePath('/', 'layout')` for the matching domain function(s), adding the routes the original (pre-Phase-1) calls missed — per the design.md per-path gap table (e.g. `create-note` → also `/subjects/[id]`; card create/delete → also `/dashboard`; `update-memory-card` → also `/memory-cards/[id]`, `/memory-cards/[id]/edit`, new note path).

**Contract**: No surface keeps a nuclear call after this phase. `seed-rows.ts` returns to (or keeps) an explicit path list.

#### 3. Per-domain E2E

**File**: extend `e2e/nav-cache.spec.ts` (or a sibling).

**Intent**: For each domain, assert "change X → it appears on consumer page Y" so a missing path fails loudly.

**Contract**: e.g. rename a subject → assert the new name in the `/notes` filter dropdown; change the daily goal → assert it on `/memory-cards`; disconnect AI → assert the generate button state on `/import`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec next typegen && pnpm typecheck`
- Lint passes on touched files: `pnpm exec eslint <touched files>`
- Unit suite green: `pnpm test`
- E2E passes: `pnpm test:e2e e2e/nav-cache.spec.ts`

#### Manual Verification:

- Each cross-cutting change (rename subject, change daily goal, disconnect AI) is reflected on its consumer pages on the next navigation.
- Navigation between _unrelated_ pages still benefits from the cache after a write (no full-tree purge).

**Implementation Note**: After Phase 2 automated verification passes, pause for human manual confirmation, then run the `slice-review-gate`.

---

## Testing Strategy

### Unit Tests:

- No new unit tests; confirm the existing core tests (`update-cores.test.ts`, `subject-cores.test.ts`) stay green — proof the bust did not leak into core.

### Integration / E2E Tests:

- `e2e/nav-cache.spec.ts` — read→read cached; UI write busts; API write reflected on revisit (Phase 1); per-domain consumer freshness (Phase 2).

### Manual Testing Steps:

1. `pnpm build && pnpm start` (or the isolated prod-test server) — never measure in `next dev` (`lessons.md:55`).
2. Navigate `/dashboard ↔ /notes ↔ /subjects` repeatedly — confirm instant repeat visits.
3. Create/edit/delete a note, card, subject; change daily goal; rate a card — confirm each reflects on the next nav.

## Performance Considerations

The win is removing the per-nav server round-trip on repeat visits within 5 minutes. The cost is the accepted cross-actor staleness window (token-API edits invisible to an open tab for ≤5 min). Phase 2 preserves cache hits on unrelated routes across writes (nuclear does not).

## Migration Notes

`lessons.md:219` ("`revalidatePath` on a dynamic page is a no-op") becomes conditional once this ships — its premise (`staleTimes.dynamic = 0`) no longer holds. Amend it during post-archive sync.

## References

- Design: `context/changes/nav-cache-staletimes/design.md`
- Lesson (the no-op premise this change flips): `context/foundation/lessons.md:219`
- Next docs: `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/staleTimes.md`, `.../04-functions/revalidatePath.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: staleTimes + nuclear bust at every surface

#### Automated

- [ ] 1.1 Type checking passes (`next typegen` + `pnpm typecheck`)
- [ ] 1.2 Lint passes on touched files
- [ ] 1.3 Unit suite still green
- [ ] 1.4 E2E passes (`e2e/nav-cache.spec.ts`)

#### Manual

- [ ] 1.5 Rapid back-and-forth navigation feels instant on the prod build
- [ ] 1.6 UI create/edit shows the change on the next navigation
- [ ] 1.7 No regression in rate-card / delete-subject / daily-goal flows

### Phase 2: granular per-domain busting

#### Automated

- [ ] 2.1 Type checking passes (`next typegen` + `pnpm typecheck`)
- [ ] 2.2 Lint passes on touched files
- [ ] 2.3 Unit suite green
- [ ] 2.4 E2E passes (`e2e/nav-cache.spec.ts`)

#### Manual

- [ ] 2.5 Each cross-cutting change reflects on its consumer pages on next nav
- [ ] 2.6 Unrelated-page navigation still cached after a write
