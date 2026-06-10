# Handoff — `revalidate-prompt-surfaces.ts`: no-op verify → delete

> Status: **DONE (2026-06-10, `13db3a6`)** — investigated, verified (docs + Playwright), and the deletion executed this session. File + both call sites removed; a one-line "no revalidate needed" comment left in each action. `systemDefaults` prop-drill thin (below) left as an optional follow-up.
> Source task: `TODO.md` → "Verify/fix `revalidate-prompt-surfaces.ts`" (review-gate altitude proposal, 2026-06-08).
> This is **code-health, not test-debt** — the test angle is already closed (no test warranted; `test-plan.md` §7 won't-do, branchless plumbing).

## The task in one line

Decide whether `src/features/openrouter/actions/revalidate-prompt-surfaces.ts` is a no-op and, if so, delete it (vs. switch to `revalidateTag`). Plus an optional adjacent cleanup (the `systemDefaults` prop-drill).

## The code under question

```ts
// src/features/openrouter/actions/revalidate-prompt-surfaces.ts
export function revalidatePromptSurfaces(): void {
  revalidatePath('/notes/new')
  revalidatePath('/notes/[id]', 'page')
  revalidatePath('/import')
  revalidatePath('/memory-cards/new')
}
```

Called at the end of **both** prompt mutations:

- `src/features/openrouter/actions/save-user-prompt.ts:41`
- `src/features/openrouter/actions/reset-user-prompt.ts:32`

**Intent:** after a user Saves/Resets their editable system prompt on one surface, bust the cached render of the _other_ `GenerateDialog`-bearing surfaces so a later navigation re-seeds the dialog from the new override. The dialog seeds its baseline from `usePromptDefault(promptKey)` ← `PromptDefaultsProvider value={getResolvedSystemPrompts()}`, resolved **server-side per page** (`src/app/(protected)/{notes/new,notes/[id],import,memory-cards/new}/page.tsx`).

## Verdict (verified): it is a **no-op for prompt freshness** → delete it

`revalidatePath` only does something if the route's output sits in a cache it can purge. Walk the three caches against these routes:

| Cache                         | Holds                                                     | These routes?                                                                                                                                                                                                                                                                                    |
| ----------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Full Route Cache** (server) | only **static** routes                                    | ❌ — all four are **dynamic**: they read `cookies()` via the Supabase server client, which opts the route out of static caching. Re-renders every request.                                                                                                                                       |
| **Data Cache**                | results of Next `fetch` / `unstable_cache`                | ❌ — `getResolvedSystemPrompts()` reads `user_prompts` through **supabase-js** (`runTableQuery`), which is **not** Next `fetch`, so nothing is stored here. (This is also why `revalidateTag` would _also_ be a no-op — there is no tagged Data-Cache entry to invalidate.)                      |
| **Client Router Cache**       | RSC payloads of visited routes, reused on soft navigation | ❌ — default `staleTimes.dynamic = 0` (**not cached**) since Next **v15.0.0**; project is on **Next 16.2.6** with **no `staleTimes`/`cacheComponents` override** (`next.config.ts` only sets `serverActions.bodySizeLimit`). Dynamic pages are refetched on every client navigation, not reused. |

**No layer is left for `revalidatePath` to bust → the helper changes nothing.** The mutation writes `user_prompts`; the next time any surface renders (always a fresh dynamic render), `getResolvedSystemPrompts()` reads the new row. The helper is dead code wearing a correctness costume.

### Bonus finding — one of the four paths is doubly pointless

`/memory-cards/new` renders **`CardForm`** (manual card creation) — it hosts **no `GenerateDialog`** at all. So revalidating it was never going to affect a prompt surface regardless of the cache analysis. The real `GenerateDialog` surfaces are: `/notes/new` + `/notes/[id]` (key `cards`, via `NoteForm`→`MemoryCardsField`; `/notes/[id]` also has `MemoryCardsSection`→`GenerateCardsButton`) and `/import` (key `notes_decompose`). Prompt keys: `cards` / `notes_decompose` / `notes_topic` (`src/features/openrouter/constants.ts:39`).

### The one residual scenario (does NOT change the verdict)

`staleTimes` explicitly does **not** govern browser **back/forward (bfcache)** — Next keeps that to preserve scroll position (`staleTimes.md` "Good to know", line 36). So in theory: open surface Y → go save on X → press the browser **Back** button to Y → bfcache _might_ show the pre-save DOM. But (a) `revalidatePath` does not reliably bust bfcache either, so the helper wouldn't fix this even if it mattered; (b) it's a narrow path (Back-button return to a generate surface immediately after editing a prompt elsewhere). Not worth keeping dead code for. Note it in the deletion commit and move on.

## Recommended action

1. **Delete** `src/features/openrouter/actions/revalidate-prompt-surfaces.ts`.
2. Remove the import + call in `save-user-prompt.ts` (line 5 import, line 41 call) and `reset-user-prompt.ts` (line 4 import, line 32 call).
3. **Do not** substitute `revalidateTag` — there is no tagged Data-Cache entry; it would be an equally-dead call. (Only relevant if someone later wraps `getResolvedSystemPrompts` in `unstable_cache` for perf — out of scope.)
4. Verify: `pnpm typecheck && pnpm lint && pnpm build`, then the manual/Playwright confirm below. Optionally run `e2e/create-note-with-checks.spec.ts` (exercises a generate surface) to confirm nothing regressed.
5. **Separate, optional** (same TODO line, lower value): `systemDefaults` is prop-drilled through ~6 wrappers but each dialog reads a single key — thin to a string or resolve at the leaf via `usePromptDefault`. Independent of the deletion; do it only if touching that area.

## How this was verified this session

- **Documentary (authoritative):** `node_modules/next/dist/docs/.../staleTimes.md` — `dynamic` default `0` since v15.0.0; `next.config.ts` sets no override. Routes confirmed dynamic (Supabase `cookies()`); `getResolvedSystemPrompts` confirmed supabase-js (not `fetch`).
- **Empirical (Playwright) — PASSED, see `## Empirical result` below.**

## Files

- `src/features/openrouter/actions/revalidate-prompt-surfaces.ts` — delete.
- `src/features/openrouter/actions/save-user-prompt.ts` — drop import+call.
- `src/features/openrouter/actions/reset-user-prompt.ts` — drop import+call.
- `src/features/openrouter/components/generate-dialog.tsx` — the dialog (no change; reference for the textarea testids).
- `src/features/openrouter/queries.ts` — `getResolvedSystemPrompts` / `getOpenRouterStatus` (reference).
- `TODO.md` — flip the item to done after deletion lands.

## Empirical result (2026-06-10, Playwright, against the prod build on :3100)

A temporary probe (`e2e/_revalidate-probe.spec.ts`, since deleted — not committed) isolated the one cache question with **no production edit**: seed a `connected` credentials row + a note; open the note read-view `cards` dialog (`cards-generate-ai` → `generate-dialog`) and record the built-in system prompt; **change `user_prompts.system` out of band** (so `revalidatePromptSurfaces` never runs); **soft-navigate** away and back via in-app `Link` clicks (nav "Notes" → note link, never `page.goto`); reopen the dialog and read `#generate-system`.

```
PROBE baseline (built-in) length: 308
PROBE afterNav contains marker? true | value head: MARKER-...-OUT-OF-BAND
1 passed (1.8m)
```

**Result: the surface showed the new prompt after soft-nav, with no revalidate having run.** The dynamic page refetched on client navigation (consistent with `staleTimes.dynamic = 0`) → there is no stale client-cache payload for `revalidatePath` to bust → **the helper is a confirmed no-op.** Proceed with the deletion above.
