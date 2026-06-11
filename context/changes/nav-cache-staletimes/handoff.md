# Handoff — nav-cache-staletimes (after Phase 1)

**Date:** 2026-06-11 · **Branch:** `main` · **Status:** Phase 1 automated+E2E done & committed; manual gate + Phase 2 pending.

## TL;DR

Phase 1 (enable the client Router Cache + bust on mutation) is **implemented, E2E-verified, committed**. A finding during E2E **reshaped the work**: route-handler `revalidatePath` is a no-op for this all-dynamic app, so the planned route-handler busts were **removed** — only the **28 Server Action busts** are load-bearing. This **changes Phase 2's scope** (see below). Resume Phase 2 in a fresh context.

## Commits (on `main`, local — not pushed)

| SHA       | What                                                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `77c5552` | (pre-session) plan committed                                                                                                                             |
| `aa0578b` | p1 code: `staleTimes.dynamic=300` + nuclear `revalidatePath('/', 'layout')` at every mutation surface (incl. route handlers, since removed)              |
| `22d1a78` | p1 E2E (`e2e/nav-cache.spec.ts`, both deliberate-break verified) + **removal of the 7 no-op route-handler busts** + docs (lessons/design/plan revisions) |

After this handoff, one more tiny commit lands the Progress SHA write-back + this file.

## The finding (why route-handler busts were dropped)

- A **Server Action**'s `revalidatePath` evicts the **calling browser's** client Router Cache (the action result carries the invalidation through the Router). This is the real, load-bearing mechanism — **28 actions**.
- A **route handler**'s `revalidatePath` returns a plain HTTP response with **no channel** to a browser, so it can only mark _server-side_ caches. This app is **all-dynamic** (cookie + supabase-js) → there is **no** Full Route / Data Cache to mark → the route-handler call is a **complete no-op** (lesson-219 family). Removed from all 6 token-API handlers, `deleteRowResponse`, and the OpenRouter callback (the connect→callback decision is moot: the full-page OAuth redirect already clears the client cache).
- E2E spec **(c)** "API write → revisit → fresh" was **dropped** — it has no deliberate-break-verifiable form (within the window an open tab stays stale by design; a cold visit to a dynamic page is always fresh regardless of the bust).
- Captured in `context/foundation/lessons.md` (new entry) + `design.md`/`plan.md` "Revision" notes.

## Phase 1 state (Progress in plan.md)

- ✅ 1.1 typecheck · ✅ 1.2 lint (2 non-gating `noteId`-unused warnings, kept for Phase 2) · ✅ 1.3 unit (`pnpm test`, 284 pass) · ✅ 1.4 E2E
- ⏳ **1.5–1.7 MANUAL — not done (human gate).** On a prod build (`pnpm build && pnpm start`): (1.5) rapid back-and-forth `/dashboard ↔ /notes ↔ /subjects` feels instant; (1.6) create/edit a note shows on next nav; (1.7) no regression in rate-card / delete-subject / daily-goal. Do these before considering Phase 1 fully closed.

### E2E specifics (`e2e/nav-cache.spec.ts`)

- 2 specs, both **deliberate-break verified**: (a) cache-on → red when `staleTimes.dynamic=0`; (b) in-app-write-busts → red when `update-note`'s `revalidatePath` removed.
- **Must use soft nav (nav-link clicks), never `page.goto`** (goto clears the client cache → vacuous test). Asserts on rendered note titles, not network introspection.
- `clientFor` client must `db.auth.stopAutoRefresh()` after use or the worker hangs 5 min → nonzero exit. (Pre-existing `isolation.spec.ts` has the same untidy pattern.)
- Requires local Supabase up (`supabase start`) — it was **down** at session start; started it this session. The E2E flakes occasionally on the GoTrue local-stack race (retries:2 absorbs it).

## Phase 2 — DEFERRED (decided 2026-06-11)

**Not building Phase 2.** Moved to the `TODO.md` Performance backlog as a future item. The open question below ("is granular worth it for a solo app?") was answered **no for now**: nuclear is correct + simple, writes are infrequent, and granular busting adds a standing path-set drift liability. Revisit only at real multi-user traffic. The revised-scope notes below are retained for whoever picks it up later.

---

## Phase 2 — REVISED scope (read before resuming)

The plan's original Phase 2 ("per-domain `revalidate.ts` shared by **both** the action and the route handler") is **partly obsolete**: route handlers no longer bust. Revised Phase 2:

- Per-domain path-set functions are imported by **Server Actions only** (no route-handler consumer — drop that half of the design's premise).
- Close the **gap map** in `design.md` for the 28 actions: e.g. `create-note` → also `/subjects/[id]`; card create/delete → also `/dashboard`; `update-memory-card` → also `/memory-cards/[id]` + edit; `getSubjects`/`getDailyGoal`/`getOpenRouterStatus` cross-cutting consumers.
- Restore the now-unused `noteId` params (`delete-memory-card`, `unlink-card-from-note`) to per-path use (clears the 2 lint warnings).
- `seed-rows.ts` `revalidateSeedPaths` → rebuild an explicit consumer path list (currently nuclear).
- E2E: per-domain "edit X → visible on consumer page Y" specs (same soft-nav discipline).
- **Open question for Phase 2:** is granular even worth it for a solo app? Nuclear is correct and simple; granular only preserves cache hits on _unrelated_ routes across writes. Consider whether to do Phase 2 at all, or close the change at Phase 1 + manual gate.

## Resume

```
/10x-implement nav-cache-staletimes phase 2
```

(Re-read this file + `design.md`/`plan.md` "Revision" notes first — the route-handler half is gone.) If skipping Phase 2: do the 1.5–1.7 manual gate, then run `slice-review-gate` → `/10x-archive`, and update `lessons.md`/`roadmap.md` per CLAUDE.md's post-archive sync. Nothing is pushed; a human pushes to remotes.
