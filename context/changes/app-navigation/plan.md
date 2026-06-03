# App Navigation (Top Bar) Implementation Plan

## Overview

Add a persistent top-bar navigation to the protected app shell so the user can move
between `/dashboard`, `/notes`, `/review`, `/subjects`, and `/settings` from anywhere,
instead of relying on ad-hoc per-page links. The bar lives once in
`(protected)/layout.tsx`, collapses to a hamburger sheet on mobile, highlights the active
route, and reuses the existing `signOut` server action. This is roadmap slice **S-10**
(v1-usable).

## Current State Analysis

- `src/app/(protected)/layout.tsx:8-17` is a Server Component auth gate that renders
  `<>{children}</>` — an empty passthrough. There is no shared chrome.
- Cross-route movement today is ad-hoc: the dashboard header carries its own
  Notes/Subjects/Settings/Sign-out buttons (`dashboard/page.tsx:38-50`); detail pages
  carry contextual `← Notes` / `← Subjects` back-buttons.
- Sign-out already exists: `src/features/auth/actions/sign-out.ts` (`signOut`, a
  `'use server'` action) used via `<form action={signOut}>`.
- `/subjects` routes already render in the working tree
  (`src/app/(protected)/subjects/{page,new,[id]}/...`), so subjects is a live link.
- No `usePathname` usage anywhere — active-link state is new.
- Root layout forces dark (`<html className="dark …">`) and `<body className="flex
min-h-full flex-col">` — a bar added as the first flex child sits above page content
  naturally.
- Page containers vary (`max-w-2xl`…`max-w-4xl`, all `mx-auto`), so the bar must be
  full-bleed with its own inner max-width container rather than inheriting a page width.
- shadcn primitives present: button, card, input, label, select, textarea, alert-dialog.
  **`sheet` is missing** and must be added for the mobile drawer.

## Desired End State

Every authenticated route renders a sticky top bar: a "Companion" brand (→ `/dashboard`)
on the left, the primary nav links, and Settings + Sign-out on the right. The current
route is visually highlighted. Below `~640px` the links collapse into a hamburger that
opens a sheet listing the same items. The dashboard no longer shows its now-redundant
header nav buttons; contextual back-buttons on detail pages remain. Verify by signing in,
navigating via the bar across all five routes (desktop and mobile widths), confirming
active-state highlight, and signing out from the bar.

### Key Discoveries:

- Single insertion point: wrap `children` in `(protected)/layout.tsx:16`.
- `signOut` is importable into a client component as a server-action reference
  (`src/features/auth/actions/sign-out.ts`) — the mobile sheet can render the same
  `<form action={signOut}>`.
- Active-link match must be segment-safe: `pathname === href || pathname.startsWith(href
  - '/')`(so`/notes/new`highlights Notes, but`/notes`never bleeds into an unrelated`/notesomething`). Same class of bug as the `proxy.ts` `startsWith` fix (lessons /
    F-01 review F2) — UI-only here, but use the safe form.

## What We're NOT Doing

- No sidebar, no bottom tab bar (top bar only — locked decision).
- No theme toggle, no breadcrumb trail, no command-palette / search.
- No dropdown user menu — Settings and Sign-out sit flat in the bar (locked decision).
- No removal of detail-page back-buttons (`← Notes` / `← Subjects`) — they are
  contextual "up" affordances the global bar does not replace.
- No schema, migration, or server-action changes.
- No new nav entry gating logic — subjects is a normal live link.

## Implementation Approach

Create a small, non-domain `app-nav` component group under `src/components/` (zero domain
knowledge — it only references route paths). The bar shell renders the route config and
the sign-out form; a `'use client'` `NavLink` owns active-route highlighting via
`usePathname`; a `'use client'` `MobileNav` owns the hamburger sheet open/close state. The
route list is a single `as const` config consumed by both desktop and mobile renderers, so
adding/removing a destination is one edit. Wire the shell into the protected layout once.
Then strip the dashboard's redundant header nav.

## Critical Implementation Details

**State sequencing** — the bar shell may stay a Server Component (it renders static links

- the server-action form). Only the two leaf islands that need browser state (`NavLink`
  for `usePathname`, `MobileNav` for sheet open state) carry `'use client'`. Keep the
  client boundary at the leaves so the bulk of the bar stays server-rendered.

## Phase 1: Nav shell + layout wiring + dashboard dedup

### Overview

Build the top-bar component group, add the shadcn `sheet` primitive, wire the bar into the
protected layout, and remove the dashboard's now-duplicated header nav buttons.

### Changes Required:

#### 1. Add the shadcn sheet primitive

**File**: `src/components/ui/sheet.tsx` (generated)

**Intent**: Provide the mobile drawer primitive the hamburger menu opens into.

**Contract**: `pnpm dlx shadcn@latest add sheet`. Adds the standard shadcn `Sheet`
exports; no manual edits expected. (`button` already exists; no other adds needed.)

#### 2. Nav route config

**File**: `src/components/app-nav/nav-items.ts`

**Intent**: Single source of the primary nav destinations, consumed by both the desktop
bar and the mobile sheet.

**Contract**: Export `NAV_ITEMS` as an `as const` array of `{ href, label }` — Dashboard
(`/dashboard`), Notes (`/notes`), Review (`/review`), Subjects (`/subjects`). Settings and
Sign-out are rendered separately (account cluster), not in this list.

#### 3. Active-aware nav link

**File**: `src/components/app-nav/nav-link.tsx`

**Intent**: A link that highlights when it points at the current route.

**Contract**: `'use client'`; named `function NavLink({ href, label }: NavLinkPropsT)`.
Uses `usePathname()`; `isActive = pathname === href || pathname.startsWith(\`${href}/\`)`.
Wraps `next/link`with a shadcn`Button` (`variant`ghost/secondary by active state) or`aria-current="page"` + a token-based active class (`text-foreground`vs`text-muted-foreground`). One component per file; co-locate `NavLinkPropsT`.

#### 4. Mobile nav (hamburger sheet)

**File**: `src/components/app-nav/mobile-nav.tsx`

**Intent**: Below the desktop breakpoint, present a hamburger that opens a sheet with the
same nav items + Settings + Sign-out.

**Contract**: `'use client'`; named `function MobileNav()`. Renders a `Sheet` triggered by
a hamburger `Button` (visible `md:hidden`). Sheet body maps `NAV_ITEMS` to links, plus a
Settings link and `<form action={signOut}>`. Closes on navigation (shadcn `SheetClose` or
`onOpenChange`). Imports `signOut` from `@/features/auth/actions/sign-out`.

#### 5. The bar shell

**File**: `src/components/app-nav/app-nav.tsx`

**Intent**: The persistent top bar composing brand, desktop links, account cluster, and
the mobile menu.

**Contract**: named `function AppNav()`. Full-bleed sticky header
(`sticky top-0 z-… border-b bg-background`) with an inner `mx-auto w-full max-w-5xl`
container matching the `p-4` page rhythm. Left: "Companion" brand `Link` → `/dashboard`.
Center/left: `NAV_ITEMS` → `NavLink` (hidden on mobile via `hidden md:flex`). Right:
Settings `NavLink` + `<form action={signOut}>` Sign-out button (`hidden md:flex`) and
`<MobileNav />` (`md:hidden`). Stays a Server Component; only the leaf islands are client.

#### 6. Wire into the protected layout

**File**: `src/app/(protected)/layout.tsx`

**Intent**: Render the bar above page content on every authenticated route.

**Contract**: Replace `return <>{children}</>` with `<><AppNav />{children}</>` (after the
auth gate). No change to the gate logic.

#### 7. Remove redundant dashboard header nav

**File**: `src/app/(protected)/dashboard/page.tsx`

**Intent**: Delete the header's Notes/Subjects/Settings/Sign-out buttons now provided
globally; keep the page title and "Signed in as {email}" and the body stat cards.

**Contract**: Remove the right-hand `<div>` of action buttons + the `signOut` form from
the dashboard `<header>` (`dashboard/page.tsx:38-50`); drop now-unused imports
(`signOut`, `Link`/`Button` if unreferenced afterward). Leave detail-page back-buttons
untouched.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Production build succeeds: `pnpm build`
- Unit tests pass: `pnpm test`

#### Manual Verification:

- The top bar appears on every protected route (dashboard, notes, review, subjects,
  settings) and not on auth pages.
- Clicking each nav item navigates to the right route; the active item is visibly
  highlighted (including on child routes like `/notes/new` → Notes active).
- At ~360px width the links collapse into a hamburger; the sheet opens, lists all items,
  navigates, and closes.
- Sign-out from the bar (desktop and sheet) ends the session and lands on `/sign-in`.
- The dashboard no longer shows duplicate header nav buttons.

**Implementation Note**: After completing this phase and all automated verification
passes, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: E2E coverage + final verification

> **DROPPED by decision (2026-06-03):** E2E coverage skipped — disproportionate for a
> presentational, no-schema nav change. The review gate + `/simplify` + a green
> `typecheck`/`lint`/`build` stand in as the pre-archive verification. Manual UI
> verification of Phase 1 was waived for the same reason.

### Overview

Add a Playwright spec exercising the nav, then run the full gate.

### Changes Required:

#### 1. Nav E2E spec

**File**: `e2e/navigation.spec.ts`

**Intent**: Prove the bar renders on protected routes, links navigate, active state is
correct, and sign-out works — using the shared harness.

**Contract**: Use `e2e/helpers.ts` (`signUp`, `uniqueEmail`). After sign-up: assert the
bar is visible; click Notes/Review/Subjects and assert each URL; assert the active
nav item reflects the current route; click Sign-out and assert redirect to `/sign-in`.
Fresh-per-test sign-up (mutation/auth-touching), consistent with the flake lesson
(`retries: 2` already configured). Mobile sheet can be asserted at a small viewport via
`page.setViewportSize` if cheap; otherwise leave to manual.

### Success Criteria:

#### Automated Verification:

- E2E suite passes (local Supabase stack up): `pnpm test:e2e`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Production build succeeds: `pnpm build`

#### Manual Verification:

- The new spec is stable across two consecutive runs (no new flake introduced).
- No visual regression on existing pages (page content still renders below the bar with
  correct spacing).

**Implementation Note**: This is the verify-green state to archive. Run the full gate
(`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build`) last.

---

## Testing Strategy

### Unit Tests:

- None required — nav is presentational + routing; behavior is best covered by E2E.

### Integration / E2E Tests:

- `e2e/navigation.spec.ts`: bar visibility, link navigation across routes, active-state,
  sign-out.

### Manual Testing Steps:

1. Sign in; confirm the bar on every protected route and its absence on `/sign-in`.
2. Click through all nav items; verify active highlight, including child routes.
3. Resize to ~360px; open the hamburger sheet; navigate; confirm it closes.
4. Sign out from both desktop bar and mobile sheet.
5. Confirm the dashboard header no longer duplicates nav.

## Performance Considerations

Negligible. The bar is mostly server-rendered; only two small client islands (`NavLink`,
`MobileNav`) ship JS. No data fetching in the bar.

## Migration Notes

None — no schema or data changes.

## References

- Change record: `context/changes/app-navigation/change.md`
- Insertion point: `src/app/(protected)/layout.tsx:8-17`
- Reused server action: `src/features/auth/actions/sign-out.ts`
- Dedup target: `src/app/(protected)/dashboard/page.tsx:38-50`
- Active-link safety (segment match): lessons.md (`proxy.ts` startsWith bleed, F-01 F2)
- E2E harness: `e2e/helpers.ts`; flake handling: lessons.md (local-GoTrue E2E flake)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.
> Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Nav shell + layout wiring + dashboard dedup

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck` — 199944b
- [x] 1.2 Linting passes: `pnpm lint` — 199944b
- [x] 1.3 Production build succeeds: `pnpm build` — 199944b
- [x] 1.4 Unit tests pass: `pnpm test` — 199944b

#### Manual

- [x] 1.5 Bar appears on all protected routes, absent on auth pages
- [x] 1.6 Each nav item navigates; active item highlighted incl. child routes
- [x] 1.7 Hamburger sheet opens/navigates/closes at ~360px
- [x] 1.8 Sign-out (desktop + sheet) ends session → `/sign-in`
- [x] 1.9 Dashboard no longer shows duplicate header nav

### Phase 2: E2E coverage + final verification

#### Automated

- [ ] 2.1 E2E suite passes: `pnpm test:e2e`
- [ ] 2.2 Type checking passes: `pnpm typecheck`
- [ ] 2.3 Linting passes: `pnpm lint`
- [ ] 2.4 Production build succeeds: `pnpm build`

#### Manual

- [ ] 2.5 New spec stable across two consecutive runs
- [ ] 2.6 No visual regression; page content spacing correct below the bar
