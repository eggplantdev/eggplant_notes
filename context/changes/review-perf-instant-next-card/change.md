---
change_id: review-perf-instant-next-card
title: Make the next review card appear instantly across all three review surfaces
status: implementing
created: 2026-06-17
updated: 2026-06-17
archived_at: null
---

## Notes

After rating a card the next card appears far too slowly. It must feel instant. Three review surfaces share the same `ReviewPanel` + `RatingButtons` + `rateMemoryCard` action and all suffer:

- `/memory-cards` (the page the user was on) — in-place `revalidatePath('/', 'layout')` re-runs all 5 page queries on every rating (subjects, paginated list, whole-deck `getCardOverview` RPC, `getDueQueue`, goal) and re-streams the whole page just to swap one prompt.
- `/dashboard` — same in-place revalidate; re-runs counts RPC + stats RPC + goal + due queue.
- `/memory-cards/[id]` — queue walk; fully serial: rate → fetch next id → `router.push` → new page re-fetches card+goal+subjects. `revalidatePath('/', 'layout')` also runs here unnecessarily and invalidates any prefetch.

Key constraint: card prompt markdown renders via `MarkdownAsync` + Shiki (async, server-only `render-markdown.tsx`), so a client-side buffer of raw card rows is the wrong tool — it would drop code highlighting or ship Shiki to the client. The right prefetch primitive is Next's **router prefetch** (caches the already-server-rendered RSC payload, Shiki markup included).

Plan must be phased: **easy wins first, harder ones after.** Ship step by step.
