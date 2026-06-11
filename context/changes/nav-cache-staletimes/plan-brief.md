# Navigation cache via `staleTimes` + mutation busting — Plan Brief

> Full plan: `context/changes/nav-cache-staletimes/plan.md`
> Design: `context/changes/nav-cache-staletimes/design.md`

## What & Why

Repeat navigation between authed pages pays a full server round-trip every time because the client Router Cache is off for dynamic routes (`staleTimes.dynamic = 0`). Turning it on makes repeat visits instant; the catch is that a cached page can now show stale data after a write, so every mutation must bust the cache.

## Starting Point

All authed pages render dynamically (cookie-bound), so the client cache never reuses them. The `revalidatePath` calls already scattered across the Server Actions are currently **dead** (`lessons.md:219` — nothing to bust at `dynamic = 0`). Notes/cards/subjects mutations run through shared `*-core.ts` modules that are unit-tested with no request scope.

## Desired End State

Navigating back and forth within 5 minutes is served from browser memory (no round-trip). Any in-app write drops the cache so the next nav is fresh; any token-API write resets the server caches (an open tab converges within the 5-min window). Proven by E2E.

## Key Decisions Made

| Decision             | Choice                                                       | Why                                                                        | Source |
| -------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- | ------ |
| Cache window         | `staleTimes.dynamic = 300`                                   | Max nav speed; also the cross-actor staleness ceiling, acceptable solo     | Design |
| Bust mechanism       | `revalidatePath('/', 'layout')` direct, no wrapper           | Framework's purge-everything switch; wrapper would only alias it           | Design |
| Where the bust lives | At each surface (action + route handler), not in `*-core.ts` | Core is unit-tested without a request scope; `revalidatePath` throws there | Design |
| Tag-based busting    | Rejected                                                     | Needs server-cached + tagged data we don't have for per-user reads         | Design |
| Sequencing           | Phase 1 nuclear everywhere, Phase 2 granular                 | Correctness first, optimize second                                         | Design |

## Scope

**In scope:** `next.config.ts` staleTimes; nuclear bust in all state-mutating Server Actions + 6 mutating API route handlers (Phase 1); per-domain path-set functions closing the gap map (Phase 2); E2E for both.

**Out of scope:** server-side caching of per-user reads (`'use cache'`); `revalidateTag`; changing `staleTimes.static`; read-only actions and the contact form.

## Architecture / Approach

One config line enables the client cache. Phase 1 puts an identical `revalidatePath('/', 'layout')` at every mutation surface, replacing the now-dead scattered calls — simple and zero-staleness. Phase 2 swaps that for per-domain functions (`revalidate.ts` per feature) that bundle the consumer-path list and are imported by both the action and the route handler, so a write evicts only relevant routes and the two surfaces can't drift.

## Phases at a Glance

| Phase                   | What it delivers                                       | Key risk                                                        |
| ----------------------- | ------------------------------------------------------ | --------------------------------------------------------------- |
| 1. staleTimes + nuclear | Instant repeat nav; zero post-write staleness          | Forgetting a redirecting action's bust-before-redirect ordering |
| 2. Granular             | Cache hits preserved on unrelated routes across writes | A missing consumer path → silent staleness (E2E guards it)      |

**Prerequisites:** none beyond the local Supabase stack for E2E.
**Estimated effort:** ~2 sessions (Phase 1 small + broad; Phase 2 per-domain + tests).

## Open Risks & Assumptions

- Cross-actor staleness ≤5 min on an open tab is accepted (token-API edits can't push to a live browser).
- `generate-cards`/`generate-notes` get **no** bust — confirmed read-only (return preview candidates, insert nothing; persistence is via the already-listed create actions).
- `lessons.md:219` must be amended post-ship (its `dynamic = 0` premise no longer holds).

## Success Criteria (Summary)

- Repeat navigation between authed pages is instant on the prod build.
- Every in-app mutation is reflected on the next navigation (no stale data).
- A token-API write is reflected on the path's next visit.
