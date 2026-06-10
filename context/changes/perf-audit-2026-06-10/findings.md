# Performance Audit — coding-learning-companion

**Date:** 2026-06-10
**Branch:** `feat/new-user-welcome-dialog`
**Stack:** Next.js 16.2.6 (App Router) · React 19.2 · Supabase (`@supabase/ssr`, RLS) · Vercel (fra1)
**Scope:** static audit of bundle/code-split, RSC boundaries, data fetching, caching/rendering, images/fonts, React perf, API routes.
**Method:** source reading + import-topology analysis (`vercel:performance-optimizer` agent) cross-checked with greps. No `next build`/analyzer run, so **byte figures are estimates from import graph, not measured**. Quantify before/after with `next experimental-analyze --output`.

> **Headline:** the data layer is genuinely strong (parallelized, column-narrowed, paginated, SQL-aggregated — no N+1). Almost every real finding is **client-bundle / config**, not data.

> ## ⚠️ MEASURED RESULT — 2026-06-10 (overrides estimates below)
>
> Empirical before/after on a real `next build` (isolated `.next-perf` dist, gzipped chunk totals; harness in `measurements/`):
>
> | Finding                         | Bundler                      | Without C1   | With C1      | Delta                               |
> | ------------------------------- | ---------------------------- | ------------ | ------------ | ----------------------------------- |
> | **C1** `optimizePackageImports` | **Turbopack** (prod default) | 3441.6 kB gz | 3441.6 kB gz | **0 kB** — identical content-hashes |
> | **C1** `optimizePackageImports` | **webpack** (`--webpack`)    | 3183.8 kB gz | 3140.8 kB gz | **−43.0 kB (−1.35%)**               |
>
> (Whole-app gzipped chunk totals; not what any single route loads.)
>
> **Root cause (proven by the cross-bundler diff):** `next build` in Next 16 defaults to **Turbopack** (`Next.js 16.2.6 (Turbopack)`). `optimizePackageImports` is a **webpack-era SWC transform** that manually de-barrels imports — it moves real bytes under webpack (−43 kB) but **exactly zero under Turbopack**, because Turbopack already tree-shakes barrels natively. The audit's C1 (and the whole "barrels pull whole packages" premise) assumed a webpack pipeline — invalid for this project. **Do not apply C1.** Even the webpack win is marginal here because `recharts` is imported as a namespace (`import * as`, un-de-barrelable) and `lucide-react` is already named-imported.
>
> **Implication for the rest:** any finding whose fix is _bundler config_ is likely Turbopack-moot. Findings that change the **module graph** (C2 = defer recharts behind `next/dynamic`; H1/H2 = remove framer from a route's initial set) are bundler-independent and remain plausible — but must be measured **per-route initial JS** (a real browser load), not whole-app chunk totals.
>
> ### Manual de-barreling (Test 2) — not an available lever here
>
> Cherry-picking "only the pieces we need" by hand, per package:
>
> - **lucide-react** (`1.16.0`): `sideEffects: false` + already named-imported → tree-shaking _already_ ships only the used icons under both bundlers. v1.16 has **no per-icon subpath** (`exports: {}`, no `dist/esm/icons/x` public entry), so manual deep-import isn't cleanly possible — and would be identical to automatic anyway.
> - **recharts**: imported as a **namespace** (`import * as`) in `chart.tsx:4` → no de-barreler (manual or config) can shrink it. Only lever is `next/dynamic` (C2).
> - **framer-motion**: single public entry, no smaller path → manual de-barrel N/A. Lever is removing usage (H1/H2).
> - **radix-ui**: the only package with a real manual lever (unified barrel → individual `@radix-ui/react-*`), but that means adding ~10 deps; under Turbopack the unified barrel already tree-shakes, so expected ≈0.
>   **Conclusion:** Test 2 reduces to what Turbopack already does automatically. At best it replicates the webpack-only −43 kB; on the actual prod bundler (Turbopack) it's 0.
>
> ### lucide → inline SVG — measured ceiling
>
> Real shipped footprint of the **20 distinct icons** actually used (raw module bytes, pre-minify): **11.8 kB raw / 7.13 kB gzipped** (incl. shared runtime). After build minification realistically ~4–5 kB gz, and **code-split per route** (no page loads all of it). Cost to capture that: hand-author/maintain 20 SVGs across 18 files, **12 of them generated `shadcn/ui/` components** that shadcn overwrites on regeneration. **Verdict: not worth it** — maintenance + shadcn-coupling hazard ≫ ~5 kB gz.

---

## Priority order to act

1. **C1** — set `optimizePackageImports` (one config line, biggest ROI).
2. **C2** + **H1** — dynamic-import recharts; de-client `PageShell` (the two structural bundle wins).
3. **H3** — stream AI generation (biggest _perceived_ latency win).
4. **H4** — `cache()`-dedupe read queries (easy TTFB win).
5. Then H2, M1–M3, L1–L2.

---

## CRITICAL

### C1 — `optimizePackageImports` is unset; barrel imports pull whole packages

**File:** `next.config.ts:14-26` (no `experimental.optimizePackageImports`)
Next 16 only auto-optimizes a built-in allow-list. The biggest offenders are **not** on it and are imported via barrels:

- `src/components/ui/chart.tsx:4` — `import * as RechartsPrimitive from 'recharts'` (full-namespace import of recharts 3.8, the single largest client dep). **Verified.**
- `radix-ui` unified barrel in ~10 `components/ui/*` files (`sheet.tsx:4`, `dialog.tsx:4`, `popover.tsx:4`, `tooltip.tsx:4`, `alert-dialog.tsx:4`, …). The unified `radix-ui` package is a barrel; without optimization Next pulls more of the Radix tree than the few primitives used.
- `framer-motion` (12.40) in 8 client files.
- `lucide-react` already uses **named** imports everywhere (verified — e.g. `model-select.tsx:3`), but still benefits from being listed.

**Cost (est.):** recharts + radix barrels dominate a shared client chunk that likely exceeds the ~200 KB-gzip INP threshold. `optimizePackageImports` commonly cuts 30–50% off these libs' contribution.

**Fix:**

```ts
experimental: {
  serverActions: { bodySizeLimit: '14mb' },
  optimizePackageImports: ['recharts', 'radix-ui', 'lucide-react', 'framer-motion', 'cmdk', '@dnd-kit/core', '@dnd-kit/sortable'],
}
```

Verify with `next experimental-analyze`.

---

### C2 — recharts shipped eagerly on `/memory-cards`, never `next/dynamic`-split

**Chain:** `app/(protected)/memory-cards/page.tsx` → `CardsOverview` → `features/memory-cards/components/cards-by-maturity-chart.tsx:1` (`'use client'`) → `RadialCountChart` → `components/ui/chart.tsx:4` (`import * as RechartsPrimitive from 'recharts'`).
Unlike CodeMirror/Shiki (correctly lazy — see _Done right_), the chart chain is a **static** client import. recharts lands in the `/memory-cards` route bundle even though the chart is one card gated behind `overview.total > 0` and is not interactive-critical.

**Cost:** inflates `/memory-cards` First Load JS and competes with hydration of the actual review panel (the interactive part). Hurts INP on the most-visited page.

**Fix:** wrap the chart at the `CardsOverview` boundary:

```ts
const Chart = dynamic(() => import('...cards-by-maturity-chart'), {
  ssr: false,
  loading: () => <Skeleton style={{ height: 200 }} />, // chart.tsx:12 declares 320×200 — match it to avoid CLS
})
```

---

## HIGH

### H1 — `PageShell` is a `'use client'` boundary on _every_ protected page, dragging framer-motion into all of them

**File:** `src/components/layout/page-shell.tsx:1-6` (`'use client'` + `framer-motion`). **Verified.**
Every protected route (`dashboard`, `notes`, `subjects/*`, `memory-cards/*`, `faq`, `settings`, `import`) renders inside `<PageShell>`, which is client _solely_ for a 0.4s mount fade (`motion.div`) and `usePathname`/`useRouter`. `children` stay server-rendered (RSC passes them through), so it's not catastrophic — but framer-motion + nav-active logic hydrate on **100%** of authenticated navigation, and the wrapper is the LCP container.

**Fix (lowest-risk first):**

1. Split into a **server** outer (`<main>` + header) + a tiny client `<FadeIn>` island wrapping only `{children}`; move the back-button `usePathname`/`useRouter` logic into a small client `<BackButton>` rendered only when `backHref/backHistory` is set.
2. Or replace the framer mount fade with a CSS `@keyframes` / `tw-animate-css` animation (**already a dependency** — `package.json:58`) and drop framer here entirely.

---

### H2 — framer-motion also in all three list components + `segmented-toggle` → effectively ubiquitous

**Files:** `features/{notes,subjects,memory-cards}/components/*-list.tsx` (via `components/motion/animated-list-item.tsx` + `animated-card-list.tsx`); `components/ui/segmented-toggle.tsx` (used in `model-select`, `subject-select`, `import-panel`, `editor-with-preview`).
Combined with H1, framer-motion loads on essentially every primary screen for decorative staggered list-entry + a toggle-indicator slide.

**Fix:** list entrance → CSS `@starting-style` / `tw-animate-css` stagger; `segmented-toggle` → CSS transform transition on an absolutely-positioned indicator. Keep framer only where genuinely needed (note-swap `template.tsx`, celebration). Doing this can drop framer from the shared bundle entirely → large First Load JS reduction (and makes C1's framer entry moot).

---

### H3 — AI generation uses non-streaming `generateObject`; import/generate blocks with no progressive output

**Files:** `features/openrouter/actions/generate-notes.ts:3,86` and `generate-cards.ts:3,85` (`generateObject`), called from `note-form.tsx:156` and `import-panel.tsx:228-233`.
`generateObject` resolves only when the **entire** object is done. For multi-note decomposition of up to 50 000 chars or a 10 MB PDF (vision), that's a single long await behind `GENERATION_TIMEOUT_MS` — opaque 30–60 s spinner, no partial notes. Not a CWV metric (post-load interaction) but the **highest-stakes latency surface** in the app.

**Fix:** switch to `streamObject` (AI SDK 6) and render notes incrementally; if Server-Action streaming is awkward, move generation to a Route Handler returning a streamed response consumed by the client panel (`streamObject` + `useObject` is the intended path). First note visible in 1–3 s instead of waiting for all.

---

### H4 — read queries aren't `cache()`-deduped → duplicate round-trips per render

**Files:** `features/subjects/queries.ts:60` (`getSubject`), `:74` (`getSubjectNoteSummaries`) — **not** wrapped in `cache()` (verified); called by both `subjects/[id]/layout.tsx:25` and `subjects/[id]/page.tsx:23,35`.
On every `/subjects/[id]` request the layout fetches `getSubject` + `getSubjectNoteSummaries`, and the index page fetches `getSubjectNoteSummaries` **again** (to decide a redirect) → a duplicate Supabase round-trip. Same layout+page-both-fetch pattern recurs elsewhere. Only `getCurrentUser` is currently `cache()`-deduped (`server.ts:31`).

**Fix:** wrap read-only query fns in React `cache()`:

```ts
export const getSubjectNoteSummaries = cache(async (subjectId, client?) => { ... })
export const getSubject = cache(async (id, client?) => { ... })
```

`cache()` keys on args; the optional injected `client` is fine since prod calls pass none. Apply to `getNote` and similar.

---

## MEDIUM

### M1 — no `'use cache'` / segment caching; per-user aggregates recompute every navigation

**Files:** all of `src/app/**` — grep for `runtime`/`dynamic`/`revalidate`/`fetchCache`/`'use cache'` → **zero hits**.
Full dynamic per-request is _correct by default_ for RLS user-scoped data. But the expensive whole-deck aggregations (`card_overview`, `card_stats`, `review_day_counts` RPCs in `dashboard/data.ts`, `memory-cards/queries.ts`) recompute on every load though they change only when the user reviews a card.

**Fix (Next 16 Cache Components):** wrap the per-user aggregate readers with `'use cache'` + `cacheTag('cards-'+userId)` / `cacheTag('reviews-'+userId)`; call `revalidateTag`/`updateTag` in the rate-card / card-mutation actions. Confirm Cache Components is enabled for the project first.

### M2 — `redirects()` on `/` is `permanent: true` (308)

**File:** `next.config.ts:27-34`. **Verified.**
`/` → `/dashboard` is a 308, aggressively browser-cached. The code's own comment on the `/review` redirect (`:38-39`) acknowledges 308s "get aggressively browser-cached" and deliberately uses 307 there — but `/` is still 308. If root ever needs a landing page or different unauthenticated routing, the 308 is sticky in users' browsers.
**Fix:** prefer `permanent: false` (307) for `/` too, consistent with the `/review` reasoning — unless root will _always_ be dashboard.

### M3 — Supabase server client recreated per query, not request-deduped

**File:** `src/lib/supabase/server.ts:9-27` — each query fn calls `createClient()` → `await cookies()` + `createServerClient`.
A page with `Promise.all` of 5 queries (e.g. `memory-cards/page.tsx:38`) builds 5 clients per request. Micro-overhead, no network.
**Fix:** wrap `createClient` in `cache()` (the `setAll` cookie-write try/catch still works). Marginal; cleaner.

---

## LOW

### L1 — `react-toastify` CSS + container in root layout for all users

**File:** `components/toast-provider.tsx:1-9`, mounted `app/layout.tsx:39`.
Loads on every page incl. pre-auth, even when no toast is shown. Small, correctly isolated leaf island.
**Fix (optional):** `next/dynamic` the `ToastContainer`, or mount it in `(protected)/layout.tsx` instead of root.

### L2 — stale default metadata

**File:** `app/layout.tsx:19-22` — `title: 'Create Next App'`, `description: 'Generated by create next app'`. **Verified.**
Not a perf issue, but it's the `<title>` shipped to every user/crawler. Fix while touching the layout.

---

## Done right (don't touch)

- **CodeMirror + Shiki correctly lazy-loaded** via `next/dynamic({ ssr:false })` — `markdown-editor.tsx:7`, `editor-with-preview.tsx:16`. `markdown-plugins.ts:10-14` documents the measured ~200-grammar / ~129 MB Shiki cost and preloads only `SHIKI_LANGS` (`lazy:true`, `fallbackLanguage:'text'`). Server markdown render stays server-side. Textbook.
- **Data fetching is parallelized**, not waterfalled — `Promise.all` at `dashboard/loader.ts:12`, `dashboard/data.ts:17`, `memory-cards/page.tsx:38`, `import/page.tsx:8`, `subjects/[id]/layout.tsx:25`.
- **Column narrowing + pagination + SQL aggregation** — listings select explicit columns (`memory-cards/queries.ts:118`, `subjects/queries.ts:44`, `notes/queries.ts:30`), paginate via `runPaginatedQuery`, push counts into RPCs (`card_overview`, `card_stats`). No N+1. The `select('*')` hits are all single-row `.eq('id',…).maybeSingle()` detail fetches (verified) — appropriate.
- **`next/font`** (`Geist`, `Geist_Mono`, `layout.tsx:9-16`) with `subsets:['latin']` + CSS vars — zero-CLS, self-hosted.
- **No raw `<img>`** — app is markdown/text; markdown images escaped server-side, so `next/image` is genuinely N/A.
- **`getCurrentUser` is `cache()`-deduped** (`server.ts:31`).
- **ReviewPanel is a server component**; confetti/celebration pushed to the `rating-buttons` client leaf. Good boundary.

---

## Verification checklist (do this when acting)

- [ ] `next experimental-analyze --output` BEFORE changes — capture First Load JS per route as baseline.
- [ ] Apply C1, re-run analyzer, record delta per route.
- [ ] Apply C2 + H1, re-run analyzer; confirm recharts/framer leave the `/memory-cards` and shared chunks.
- [ ] Confirm no CLS regression from the dynamic chart skeleton (match 320×200).
- [ ] H3: verify streaming works against a real long generation (50k chars / 10 MB PDF).
