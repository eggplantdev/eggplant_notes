# Design — navigation cache via `staleTimes` + mutation busting

**Change id:** `nav-cache-staletimes`
**Date:** 2026-06-11
**Status:** design (pre-plan)
**Roadmap:** closes the caching half of **S-11** (the over-fetch/query half is already done — see `context/changes/query-performance-audit/audit.md`).

## Problem & reframe

The felt slowness on in-app navigation is **the per-nav server round-trip, not the query** — reads are already lean. Every page that reads cookie-scoped (per-user) data renders dynamically, and the client **Router Cache** TTL for dynamic routes defaults to **0** (`staleTimes.dynamic`), so going `/dashboard → /notes → back` pays a fresh server render each hop.

That makes this a **client-navigation-cache** problem, not a server-data-cache problem. Crucially, the Router Cache is **per-browser, in-memory** — it only ever holds the authenticated user's own RSC payloads. So there is **no RLS/cookie blocker** here: the thing that blocked `'use cache'` (shared server memory with no request cookies, forcing us to drop RLS to cache per-user reads) simply does not apply to the client cache.

## Goal / non-goals

**Goal:** Make read→read navigation instant within a window, without ever showing stale data after an in-app write.

**Non-goals:**

- Server-side data caching of per-user reads (`'use cache'`/`unstable_cache`) — still blocked by RLS, out of scope.
- Tag-based busting (`revalidateTag`) — requires server-cached + tagged data; we have neither for per-user reads, so it cannot evict anything here. Path-based busting only.
- Instant cross-device freshness — see the limitation below.

## Verified facts (Next.js 16.2.6, from `node_modules/next/dist/docs/`)

1. `experimental.staleTimes` configures the **client cache** (in-browser RSC payload store). `dynamic` default **0**, `static` default **300s**.
2. `revalidatePath('/', 'layout')` invalidates the **root layout**, which cascades to _all nested layouts and all pages beneath them_ = the entire route tree. This is the framework's own purge-everything switch — no wrapper needed.
3. `revalidatePath` is callable in **Server Functions and Route Handlers** (not client components).
4. Caller behavior differs:
   - **Server Action:** updates the UI immediately and refreshes previously-visited pages on next nav → busting reaches _this_ browser.
   - **Route Handler:** _marks_ the path for revalidation, applied on the path's **next visit** → server caches reset, but **no push to a live browser tab**.
5. Client cache is also invalidated by `revalidateTag`/`revalidatePath`/`updateTag`/`router.refresh`/`cookies.set|delete`, and is cleared on full page refresh.

## Key limitation (accepted)

An external agent writing via the **token HTTP API** (a Route Handler) resets the **server** caches immediately, but **cannot evict an already-open browser tab's client cache** — there is no server→client push channel. That tab converges only when its own client-cache entry lapses (the `staleTimes.dynamic` window) or the user refreshes.

Therefore `staleTimes.dynamic` is **both** the read→read nav window **and** the ceiling on how long an open tab can show data an agent already changed. Decision: `dynamic: 300` (5 min) — max nav speed; acceptable cross-actor staleness for a solo app where in-app writes always reset to fresh.

## Design

### Phase 1 — `staleTimes` + nuclear bust at every surface

- **Config:** `next.config.ts` → `experimental.staleTimes: { dynamic: 300 }` (leave `static` at its 5-min default).
- **Bust:** call `revalidatePath('/', 'layout')` **directly** (no wrapper — it would only alias one framework call) at the end of every state-mutating surface, after the mutation succeeds:
  - every state-mutating **Server Action** (excludes read-only actions like `get-notes-for-linking`, `list-models`, `list-favorite-models`),
  - every mutating **API route handler** (POST/PATCH/DELETE on `notes`, `notes/[id]`, `memory-cards`, `memory-cards/[id]`, `subjects`, `subjects/[id]`).
- **Net effect:** instant read→read nav within 5 min; any in-app write nukes that browser's cache (zero staleness); any API write resets server caches (browser converges ≤5 min).

**Why at the surfaces, not in the shared `*-core.ts`:** the core mutation modules are unit-tested directly (`src/__tests__/update-cores.test.ts`, `subject-cores.test.ts`) with **no request scope and no `next/cache` mock**. `revalidatePath` throws outside a request, so putting it in core would break those tests (or force a mock boundary this project deliberately distrusts). Core stays pure; each surface busts.

**Sync guard:** "API write → revisit → fresh" E2E (below) fails loudly if a route forgets to bust — that is how the two surfaces are kept in sync, since the bust can't live in shared core.

### Phase 2 — granular per-domain busting

Replace the nuclear call with per-domain path sets so a write only evicts routes that actually display that data (unrelated routes keep cache hits across writes). Each domain owns a small `revalidate.ts` exporting a function that **bundles a path list** (this is real data worth naming — unlike the Phase-1 single call), imported by _both_ the action and the route handler so they can't drift:

```ts
// src/features/subjects/revalidate.ts (illustrative)
export function revalidateSubjectConsumers() {
  for (const p of ['/subjects', '/notes', '/memory-cards', '/import']) revalidatePath(p)
}
```

Dynamic children need the segment form: `revalidatePath('/notes/[id]', 'page')` or a `revalidatePath('/notes', 'layout')` sweep — a bare `/notes/[id]` string won't match.

#### Gap map (the consumer/eviction matrix Phase 2 must close)

Three cross-cutting reads appear on many routes but are evicted on only their "home" route today:

| Shared read                         | Routes that display it                                                                                           | Mutations that change it                     | Evicts today                    | Stale on                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------- | -------------------------------------------------- |
| `getSubjects()` (filters/dropdowns) | `/subjects`, `/notes`, `/notes/[id]`, `/memory-cards`, `/memory-cards/new`, `/memory-cards/[id]/edit`, `/import` | create/update/delete-subject                 | `/subjects` (+`/subjects/[id]`) | all 6 other routes                                 |
| `getDailyGoal()`                    | `/dashboard`, `/memory-cards`, `/memory-cards/[id]`, `/settings`                                                 | update-daily-goal                            | `/dashboard`                    | `/memory-cards`, `/memory-cards/[id]`, `/settings` |
| `getOpenRouterStatus()`             | `/settings`, `/import`, `/notes/new`, `/notes/[id]`, `/memory-cards/new`                                         | connect/disconnect/set-model/toggle-favorite | `/settings`                     | `/import` + the 3 new/edit pages                   |

Per-path gaps:

| Mutation                                                                                      | Evicts today                     | Missing                                                                                                  |
| --------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `create-note`                                                                                 | `/notes`                         | `/subjects/[id]` (sidebar note summaries)                                                                |
| `update-note` (title)                                                                         | `/notes`, `/notes/[id]`          | `/subjects/[id]`, `/subjects/[id]/[noteId]`                                                              |
| `create-standalone-card`, `create-memory-card`, `create-cards-for-note`, `delete-memory-card` | `/memory-cards` (+`/notes/[id]`) | `/dashboard` (due-queue count + stats; `rate-memory-card` already evicts it — omission is inconsistency) |
| `update-memory-card`                                                                          | `/notes/{prev}`, `/memory-cards` | `/memory-cards/[id]`, `/memory-cards/[id]/edit`, `/notes/{new}`                                          |
| `delete-subject` (cascades)                                                                   | `/subjects`, `/notes`            | `/memory-cards`, `/dashboard` + subject-dropdown consumers                                               |

Well-covered (no action): `rate-memory-card`, all `api-tokens` (settings-only), `link/unlink-card` (mostly).

## Testing (E2E — the only layer that observes the Router Cache)

Staleness is a browser behavior; unit tests cannot see the client cache. Per `context/foundation/test-plan.md`, authored via `/10x-e2e`.

- **Phase 1:** (a) UI write → navigate → fresh DOM; (b) API write → revisit path → fresh; (c) read→read nav served from cache (no refetch within window).
- **Phase 2:** per-domain "edit X → visible on page Y" specs that fail if a path is missing from the domain's set.

## Decisions

- `staleTimes.dynamic = 300` (5 min); `static` left at default.
- Bust = direct `revalidatePath('/', 'layout')`; **no wrapper** in Phase 1.
- Bust lives at the two surfaces (action + route handler), **not** in shared `*-core.ts` (preserves pure, request-scope-free unit tests).
- Phase 2 per-domain functions exist because they bundle a path _list_, and are shared by both surfaces.

## Open questions

None.

## Revision — route-handler busts dropped (2026-06-11, during Phase 1 implementation)

The original design put `revalidatePath('/', 'layout')` at **both** surfaces (Server Action **and** route handler). Implementation + the E2E gate proved the **route-handler half is a no-op** and it was removed. Why:

- A **route handler**'s `revalidatePath` returns a plain HTTP response with no Router channel back to the browser, so it can only mark **server-side** caches — it can never evict a browser's client Router Cache. Only a **Server Action**'s `revalidatePath` reaches the calling browser (fact 4, re-read correctly).
- This app is **all-dynamic** (cookie + supabase-js), so there is **no** Full Route Cache and **no** Data Cache to mark either. The route-handler call therefore resets _nothing that exists_ — a complete no-op (same family as `lessons.md` "`revalidatePath` on a dynamic page is a no-op").
- The token API is hit by external agents (no browser/client cache in play). The OAuth callback is doubly moot — it's a route handler **and** the full-page OAuth redirect already clears the entire client cache on return; the earlier "connect → bust in the callback" decision was based on a staleness that does not occur.
- The **"sync guard" E2E** (spec c, "API write → revisit → fresh") has no valid form: within the window an open tab stays stale (this design's own "Key limitation"), and a cold visit to a dynamic page is always fresh regardless of the bust — so a deliberate-break check can never make it red. Dropped.

**Net:** only the **28 Server Action busts** remain (load-bearing, proven by spec b). The 6 token-API route-handler busts + `deleteRowResponse` + the callback bust were removed. Cross-actor (token-API) freshness on an open tab remains bounded by the `staleTimes.dynamic` window — the accepted limitation, now the _only_ mechanism, not a bust. Lesson captured in `lessons.md`. If any route ever serves a server-cached output (static/ISR/`'use cache'`), revisit. Phase-1 E2E = specs (a) cache-on + (b) in-app-write-busts only.
