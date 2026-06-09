---
change_id: faq-page
title: In-app FAQ page (static first pass)
status: archived
created: 2026-06-09
updated: 2026-06-09
archived_at: 2026-06-09T08:55:28Z
---

## Notes

Standalone change (not a roadmap slice; no Linear issue). Brownfield "scuffle"
first pass: a protected, in-app `/faq` route explaining the app's data handling,
AI features, and CLI/agent API.

Full approved design + decisions: `design.md` (in this folder). Summary:

- **Audience:** protected, in-app (added to `NAV_ITEMS`). Not public.
- **Polish:** static content only — typed `FAQ_SECTIONS` array, no DB / search / MDX.
- **PDF/vision note input:** documented as "coming soon" (Phase 2, not shipped).
- **Agent skill bullet:** documentation-only — FAQ explains how to point an agent
  at the CLI token API; no new agent skill built.
- **AI section:** includes how to disconnect OpenRouter / revoke app access from
  the user's OpenRouter account home (added per user request).

### Files

- `src/app/(protected)/faq/page.tsx` — Server Component, `PageShell` `width="wide"`.
- `src/features/faq/faq-data.ts` — typed static content + its own contract types.
- `src/features/faq/components/faq-accordion.tsx` — client multi-open disclosure,
  reuses `components/ui/accordion-arrow`.
- `src/components/app-nav/nav-items.ts` — `+{ href: '/faq', label: 'FAQ' }`.

### Review gate (2026-06-09)

- `/code-review`, `tailwind-v4-audit`, `structure-scatter-audit`: clean except 3
  cheap a11y/robustness fixes (applied): always-mount the disclosure panel so
  `aria-controls` resolves while collapsed; single `itemId` instead of dual
  key/panelId strings; `scope="col"` on table headers.
- `/simplify`: 1 applied (id unification); 1 proposed/held (extract a shared
  `<Disclosure>` primitive — the group-button+AccordionArrow idiom now recurs in
  4 places; cross-feature refactor, out of slice scope).
- Tests: deferred (static copy + one toggle, below test-plan.md risk bar).
- Full suite: skipped by user — tree doesn't compile due to a parallel session's
  `layout.tsx`; FAQ files verified lint/type/prettier-clean in isolation.

### Outstanding before this is truly done

- Not committed (on parallel branch `feat/new-user-welcome-dialog`); commit on a
  dedicated `feat/faq-page` branch off HEAD.
- Re-run the real full suite once the tree compiles again.
