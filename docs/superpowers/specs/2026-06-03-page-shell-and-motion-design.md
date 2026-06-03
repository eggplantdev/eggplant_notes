# Page shell + motion — design

**Date:** 2026-06-03
**Status:** approved
**Scope:** off-roadmap UI consistency pass. Not a `/10x` change — no change folder, no per-slice review gate.

## Problem

Every page under `src/app/(protected)` hand-rolls its own `<main>` wrapper, and they've drifted:

| Page           | max-width   | padding      | gap | vertical align             | title         |
| -------------- | ----------- | ------------ | --- | -------------------------- | ------------- |
| dashboard      | none (full) | `p-4 sm:p-6` | 4   | top                        | h1 + subtitle |
| notes          | `2xl`       | `p-4`        | 6   | top (`min-h-svh`)          | h1 + action   |
| subjects       | `2xl`       | `p-4`        | 6   | top (`min-h-svh`)          | h1 + action   |
| review (card)  | `2xl`       | `p-4 sm:p-6` | 4   | top                        | h1 + "N due"  |
| review (empty) | `2xl`       | `p-4 sm:p-6` | 4   | top                        | **none**      |
| settings       | `md`        | `p-4`        | 6   | **`justify-center`** (bug) | h1            |

Concrete defects this fixes:

1. **Settings content is vertically centered** — `justify-center` + `min-h-svh` on its `<main>` (settings/page.tsx). Every other page is top-aligned.
2. **Review loses its title in the empty state** — the card branch has `<h1>Review</h1>`; the "All caught up" branch has none.
3. **Page titles are duplicated on mobile** — `CurrentPageLabel` already pins the section name top-left on mobile for every nav route, so each page `<h1>` is redundant chrome on small screens.
4. **Padding / gap / max-width drift** — no single source of truth.

## Decisions (locked with user)

- Wrapper owns: **layout shell + title + actions slot + page-transition motion**.
- Shell default is **full-width** (padding only). Read-heavy pages opt into an inner `max-w` for legibility via a `width` prop.
- **All** `(protected)` pages migrate (top-level + detail/new/edit), in one pass.
- New dependency: **`framer-motion` (latest)**. fest imports from `'framer-motion'`, so ported components keep that path.
- Page transition runs on **all** pages including `/review` (no special-casing for now — evaluate after seeing it live).

## Patterns ported from `fest` (`/Users/konradantonik/workspace/fest/fest-frontend`)

- `components/wrappers/page-transition.tsx` + `animated-list.tsx` (`AnimatedWrapper`): `AnimatePresence mode="wait"` + `motion.div`, fade + 20px slide-in, `useReducedMotion` → opacity-only fallback. **Folded directly into `PageShell`** (fest's `PageTransition` carries unused `locale`/`isHeroPage`/`hideLogo` props — not ported).
- `components/wrappers/animated-list-item.tsx`: `motion.div`, fade+slide, opt-in `layout`/`layoutId` for FLIP reordering, reduced-motion aware. **Ported verbatim.** Consumers wrap a `.map()` in `<AnimatePresence mode="popLayout">` and render each row as `AnimatedListItem` keyed by id.

## Components

### 1. `src/components/layout/page-shell.tsx` (client)

```tsx
type PropsT = {
  title: string
  actions?: ReactNode // trailing button / "N due" text
  width?: 'full' | 'prose' // 'full' (default, dashboard); 'prose' = mx-auto max-w-2xl
  children: ReactNode
}
```

- `<main>`: `p-4 sm:p-6`, `flex flex-col gap-6`, top-aligned. No `justify-center`, no `min-h-svh`.
- `width='prose'` → inner content gets `mx-auto max-w-2xl`; `'full'` → edge-to-edge.
- Header row: `<h1 className="hidden text-2xl font-semibold md:block">{title}</h1>`; `actions` wrapped with `ml-auto` so they stay right-aligned on both breakpoints even when the h1 is hidden. Title always renders → review empty state keeps a title.
- Wraps `children` in the page-transition `motion.div` (constant key → animates on each mount, matching fest).
- Client component, but server-rendered pages pass their content as `children` — data fetching stays on the server.

### 2. `src/components/motion/animated-list-item.tsx` (client)

Ported from fest verbatim. `cn` from the project's existing util.

### 3. List wiring

Extract client list components that receive the fetched array as a prop:

- `src/features/notes/components/notes-list.tsx`
- `src/features/subjects/components/subjects-list.tsx`

Each renders `<AnimatePresence mode="popLayout">` over `AnimatedListItem` rows (keyed by id, `layout` + `layoutId`). The page (Server Component) fetches and passes data down. On revalidate-after-create, the new row animates in.

## Migration

Every `(protected)` page returns `<PageShell title=… actions=… width=…>` instead of a bespoke `<main>`. Width map: dashboard `full`; everything else `prose`.

## Directory rationale

`components/layout/` (shell) and `components/motion/` (motion primitives) — non-domain primitives split into two cohesive homes rather than one `wrappers/` grab-bag.

## Out of scope

- Add-without-navigation (true optimistic insert) — current flow navigates to `/new` then revalidates; the entry animation on revalidate is the win.
- Auth pages (`(auth-pages)`) — not part of the protected shell.
