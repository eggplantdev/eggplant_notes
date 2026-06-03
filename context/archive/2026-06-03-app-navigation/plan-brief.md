# App Navigation (Top Bar) — Plan Brief

> Full plan: `context/changes/app-navigation/plan.md`

## What & Why

Add a persistent top-bar navigation to the protected app shell (roadmap slice S-10,
v1-usable). The app has six protected routes but no shared chrome — movement relies on
ad-hoc per-page links. With subjects landing for the 06-10 subset, the missing nav is real
friction.

## Starting Point

`(protected)/layout.tsx` is an auth gate that renders `<>{children}</>` with no chrome.
`signOut` already exists as a server action; `/subjects` routes already render in the
working tree; no `usePathname`/active-link state exists anywhere yet.

## Desired End State

Every authenticated route shows a sticky top bar: "Companion" brand → `/dashboard`, links
to Dashboard/Notes/Review/Subjects, and Settings + Sign-out on the right. The active route
is highlighted; below ~640px the links collapse into a hamburger sheet. The dashboard's
now-redundant header nav buttons are removed; detail-page back-buttons stay.

## Key Decisions Made

| Decision            | Choice                                            | Why (1 sentence)                                                      | Source |
| ------------------- | ------------------------------------------------- | --------------------------------------------------------------------- | ------ |
| Layout pattern      | Top bar only, hamburger sheet on mobile           | Simplest pattern that fits ~5 routes; locked with user.               | Plan   |
| Slice scope         | Own slice (S-10), not folded into S-04            | Nav is cross-cutting; clean deletion test + independent review gate.  | Plan   |
| Account actions     | Settings + Sign-out flat in the bar (no dropdown) | No new dependency, fewer clicks; collapses into the sheet on mobile.  | Plan   |
| Subjects link       | Normal live link (not disabled)                   | Routes already render in the working tree; supersedes change.md note. | Plan   |
| Existing inline nav | Remove dashboard header links; keep back-buttons  | Kills true duplication while preserving contextual "up" navigation.   | Plan   |
| Sign-out            | Reuse existing `signOut` server action            | Already used via `<form action={signOut}>`; no new server code.       | Plan   |

## Scope

**In scope:** top-bar shell component group, shadcn `sheet` add, active-link client
component, mobile hamburger sheet, wiring into the protected layout, dashboard dedup, an
E2E spec.

**Out of scope:** sidebar/bottom-bar, dropdown user menu, theme toggle, breadcrumbs,
search/command palette, removing detail-page back-buttons, any schema/server change.

## Architecture / Approach

A non-domain `src/components/app-nav/` group: `nav-items.ts` (route config), `nav-link.tsx`
(`'use client'`, `usePathname` active state), `mobile-nav.tsx` (`'use client'`, sheet),
`app-nav.tsx` (server-rendered shell composing brand + desktop links + account cluster +
mobile menu). Wired once into `(protected)/layout.tsx` above `children`. Client boundary
kept at the two leaf islands.

## Phases at a Glance

| Phase                                   | What it delivers                        | Key risk                                    |
| --------------------------------------- | --------------------------------------- | ------------------------------------------- |
| 1. Nav shell + wiring + dashboard dedup | Working top bar on all protected routes | Active-match bleed; sheet client boundary   |
| 2. E2E + final verification             | `navigation.spec.ts` + full green gate  | Local-GoTrue E2E flake (mitigated: retries) |

**Prerequisites:** local Supabase stack up for E2E; shadcn `sheet` add.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Subjects link correctness depends on the uncommitted S-06 routes staying in place.
- Mobile sheet E2E may be left to manual if viewport assertions prove flaky.

## Success Criteria (Summary)

- User navigates between all protected routes from any page via the bar.
- Active route is highlighted; mobile collapses to a working hamburger sheet.
- Sign-out works from the bar; dashboard duplication is gone; full gate is green.
