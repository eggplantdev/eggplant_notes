---
change_id: app-navigation
title: Persistent top-bar navigation for the protected app shell
status: archived
created: 2026-06-03
updated: 2026-06-03
archived_at: 2026-06-03T17:08:43Z
---

## Notes

Roadmap gap (S-10, v1-usable): the protected app has six routes (`/dashboard`, `/notes`,
`/notes/new`, `/notes/[id]`, `/review`, `/settings`) but `(protected)/layout.tsx` only does
the auth gate — there is no shared nav. Movement between routes is ad-hoc per-page links
(e.g. the S-01 review's "add a dashboard → Notes link" accepted finding). With S-06 subjects
landing for the 06-10 subset, the missing nav becomes real friction.

Locked decisions (from planning discussion 2026-06-03):

- **Layout:** top bar only — single horizontal header inside the protected shell; collapses
  to a hamburger sheet on mobile (~360px). Not sidebar, not bottom tab bar.
- **Slice scope:** its own standalone slice (S-10 `app-navigation`), NOT folded into the
  in-progress S-04 dashboard work. Clean deletion test + independent review gate.
- **Subjects entry:** design the nav with a `/subjects` item from the start, even though
  S-06 isn't implemented yet — ship it hidden/disabled until S-06 lands, so nav isn't
  re-touched immediately after.
- **Home/brand:** "Companion" brand on the left (links to `/dashboard`); settings on the right.

Open for `/10x-plan`: exact nav item set + active-route highlighting, where the bar lives
(belongs in `(protected)/layout.tsx` as the shared shell), shadcn primitives for the mobile
sheet, and how the disabled-until-S-06 subjects entry is gated.

## As-built deltas (2026-06-03)

Decisions changed during implementation (superseding the locked notes above):

- **No brand.** The "Companion" wordmark was dropped — it was redundant with the Dashboard
  nav link (both → `/dashboard`). Nav links only.
- **Subjects is a normal live link**, not disabled — its routes already render in the working
  tree (S-06 in flight), so a disabled/hidden entry would have been dead UI.
- **Mobile has no bar.** The header is `hidden md:block`; on mobile only a `fixed` floating
  hamburger (top-right) opens the sheet. The empty bar held nothing else on mobile. Layout
  adds `pt-14 md:pt-0` so content clears the floating button (incl. note-detail top-right
  actions). Sheet background overridden to `bg-background` (near-black) over the shadcn
  `bg-popover` default.

Review gate: parallel fan-out (impl-review / tailwind-v4 / feature-first + cohesion) — all
PASS, 0 critical / 0 warning. `/simplify` extracted the duplicated sign-out form into
`features/auth/components/sign-out-button.tsx` and dropped an unused `NavItemT` export. E2E
(plan Phase 2) and formal manual verification waived by decision — disproportionate for a
presentational, no-schema change. Green: `typecheck` / `lint` / `build`.
