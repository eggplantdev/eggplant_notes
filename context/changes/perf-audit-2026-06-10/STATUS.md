# Perf Audit — STATUS

Scannable tracker for `findings.md` (which holds the full rationale). Tick as you go.

**Closed:** C2 ✅ recharts lazy-loaded (`ab5f775`, `03ac90b`, `bd7afe7`) · C1 🚫 won't-do — Turbopack-moot (`lessons.md:205`) · H1/H2 🚫 won't-do — framer-motion stays (informed decision; noted in `AGENTS.md`) · L1 🚫 won't-do — toasts fire on auth + protected pages, so the container must stay in root layout; no toast-free surface to save · M3 🚫 won't-do — marginal; `cookies()` is already per-request memoized and `createClient` is allocation-only (no network), so the dedup buys ~4 cheap object allocs/request, no metric impact · L2 ✅ real title/description (`eggplant_ai_notes`).

## Open — priority order

- [ ] **H3** · AI gen uses non-streaming `generateObject` → `streamObject` + incremental render · `generate-notes.ts:86`, `generate-cards.ts:85` · **L**
- [x] **H4** · `getSubject`/`getSubjectNoteSummaries` `cache()`-deduped · `subjects/queries.ts` · **S** — collapses the /subjects/[id] layout+page double-fetch to one round-trip.
- [~] **M1** · per-user aggregates recompute every nav → `'use cache'` + `cacheTag`/`updateTag` · **tracked by roadmap S-11 (`data-fetching-efficiency`, proposed/v2)** — same approach, with the RLS-vs-`'use cache'` cookie blocker + `cacheComponents` precondition already analyzed (`roadmap.md:269-286`). Do NOT plan from this audit; it ships with S-11.
- [x] **M2** · `/`→`/dashboard` now 307 (`permanent: false`) · `next.config.ts` · **XS** — keeps root reroutable; aligns with the `/review` redirect.
- [x] **L2** · stale `'Create Next App'` metadata → real title/description · `app/layout.tsx:19-22` · **XS** — title `eggplant_ai_notes` + real description.
