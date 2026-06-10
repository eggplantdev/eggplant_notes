# Chaos-Monkey UI Audit — Findings (action items)

**Date:** 2026-06-10
**Branch / worktree:** `audit/chaos-monkey-ui` (`/Users/konradantonik/workspace/10x_devs-chaos`)
**Surface under test:** local **production build** (`NEXT_DIST_DIR=.next-prodtest`, `pnpm start -p 3250`) against the local Supabase stack.
**Scope:** full manual chaos audit of the whole app — auth, subjects/notes/cards CRUD, import & review panels (non-AI paths), navigation, error/empty states, desktop + mobile.
**Out of scope:** AI generation features (OpenRouter card/note generation) — owner tests these.

> **Noise removed (2026-06-10):** the original audit logged 30+ works-as-designed / pass observations (auth gating, API 401s, XSS-escaping, full CRUD + cascades, import split, review scheduler, OpenRouter OAuth redirect, token mint/revoke, responsive layout — all verified working). Those required no action and have been stripped, along with their pass-state screenshots. Only the findings below need a fix.

> **Status (2026-06-10): all 6 fixed and verified.** Unit suite green (271 passing); the 3 visual/behavioral fixes (R-1, N-1, M-7) were re-verified in a Playwright browser pass against the local prod build (port 3250, `test@gmail.com` real-content account) — see per-finding notes.

---

## Severity legend

| Tag          | Meaning                                                             |
| ------------ | ------------------------------------------------------------------- |
| 🟠 **Major** | Wrong behavior, confusing UX, broken layout on a supported viewport |
| 🟡 **Minor** | Cosmetic, polish, edge-case wart                                    |

---

## Findings

| #       | Sev          | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **X-1** | ✅ **FIXED** | **React hydration error #418 on `/notes`** (reproduced on every load, desktop + mobile). Root cause: `formatLocaleDate()`/`formatLocaleDateTime()` in `src/lib/utils/date.ts` called `toLocale*` with **no fixed locale or `timeZone`** — SSR rendered with the server's locale + UTC (`6/10/2026`), the client re-rendered with the browser's locale + zone (`11.06.2026`) → text-content mismatch → #418. **Fix:** pinned `en-US` + `timeZone: APP_TIME_ZONE` (`Europe/Warsaw`) on both helpers (`src/lib/utils/date.ts:77-86`). Regression guard in `src/__tests__/date.test.ts` flips `process.env.TZ` between two zones and asserts identical output (14/14 green). **Browser-verified:** `/notes` now loads with 0 console errors (was 1× #418 every load). |
| **R-1** | ✅ **FIXED** | **Answer-reveal state did not reset between cards.** After rating, the panel advanced in place to the next card with the answer **already expanded** — no recall step. Root cause: `ReviewPanel` re-renders in place, so React reused the same uncontrolled `Collapsible` client instance and its `open` state leaked across the card swap. **Fix:** `key={card.id}` on the `Collapsible` (`src/features/review/components/review-panel.tsx:52`) forces a fresh (closed) instance per card. **Browser-verified:** revealed answer, rated Good across 3 consecutive cards — each next card loaded with the answer `data-state="closed"`.                                                                                                                           |
| N-1     | ✅ **FIXED** | **Inline code rendered with literal backticks** (`` `lru_cache` `` instead of `lru_cache`), across preview + saved note + card rendering. **Root cause was NOT the markdown renderer** (the audit's guess) — reproduced the pipeline directly and the DOM is clean `<code>inline code</code>`. The backticks are `@tailwindcss/typography`'s default `code::before`/`code::after` pseudo-content; the audit saw rendered glyphs, not DOM text. **Fix:** override `.prose code::before/::after { content: none }` in `src/app/globals.css` (unlayered, beats the plugin's `:where()` selector). One CSS rule fixes every prose surface. **Browser-verified:** inline `<code>` now computes `::before`/`::after` `content: none` (was ``"`"``).                     |
| U-4/S-1 | ✅ **FIXED** | **Duplicated validation messages, project-wide** (`"X, X"`). Cause: fields wire the same Zod schema to both `onBlur` and `onSubmit` (intentional — live-validate touched fields, still catch never-blurred ones at submit), so TanStack Form accumulates one identical issue per validator and the shared renderer joined both. **Fix:** dedupe via `Set` in `getFieldErrorText` (`src/components/forms/utils.ts`) — one change covers every TanStack form, and keeps the `onSubmit` validator that untouched fields rely on. Regression test in `src/__tests__/form-utils.test.ts` (added to Stryker's mutate glob); 19/19 green.                                                                                                                                |
| X-2     | ✅ **FIXED** | **Inconsistent date format across views** (related to X-1): notes **list** showed `DD.MM.YYYY`, note **detail** showed `M/D/YYYY`, plus a **timezone off-by-one**. Resolved by the same X-1 fix — both views now format via one pinned zone (`Europe/Warsaw`) + locale (`en-US`). (The list staying date-only vs detail showing date+time is intentional, not the inconsistency reported here.)                                                                                                                                                                                                                                                                                                                                                                   |
| M-7     | ✅ **FIXED** | **Note form, cosmetic (390px):** the "Memory cards (optional)" label crowded the "Generate with AI" + "Add card" buttons. **Fix:** header row is now `flex-col gap-3 sm:flex-row sm:items-center sm:justify-between` (`src/features/notes/components/memory-cards-field.tsx`) — label stacks above the buttons below `sm`, side-by-side at `sm`+. **Browser-verified at 390px:** container computes `flex-direction: column`, label sits above the buttons, no horizontal overflow.                                                                                                                                                                                                                                                                               |

---

## Top fixes, in priority order

1. ✅ **X-1 — `/notes` hydration error (#418).** Done — pinned locale + `APP_TIME_ZONE` in `formatLocaleDate`/`formatLocaleDateTime` (`src/lib/utils/date.ts:77-86`); also resolved X-2. Regression guard added.
2. **R-1 — review answer reveal doesn't reset.** Reset `showAnswer` when the current card changes in the review widget. Defeats spaced-repetition recall — core-feature correctness.
3. ✅ **N-1 — inline code renders literal backticks.** Done — was `@tailwindcss/typography` pseudo-content, not the renderer; overrode `.prose code::before/::after` in `globals.css`.
4. ✅ **U-4 — duplicated validation messages.** Done — deduped in `getFieldErrorText` (`forms/utils.ts`); regression test added.
5. ✅ **M-7 — note-form label wrap on mobile.** Done — header stacks `flex-col` below `sm`.

## Out of scope (owner-tested) / not exercised

- All **AI generation** paths (note/card generation via OpenRouter) — owner tests these. Only the **Connect** OAuth redirect was verified (works).
- **Delete account** — would destroy the audit account.
- **Drag-to-reorder** notes, clipboard copy of skill/token, PDF import — surfaced but not driven.
