# Coding Learning Companion — Backlog

> Markdown notes grouped into subjects + spaced-repetition recall cards. Eggplant-branded.
> **The product WORKS** — roadmap S-01..S-10 shipped. This backlog is post-deadline polish + new features, not critical-path.
> _Status snapshot: 2026-06-10._

---

## ✅ At a glance

**Left to do**

- [ ] **Eggplant logo** — brand mark for nav / landing / favicon (no asset yet).
- [ ] **Performance / route caching (S-11)** — has a real architectural blocker (per-user cache vs RLS cookie).
- [ ] **Mobile pass** — check + fix layouts on small screens.
- [ ] **User account page** — deferred ("konto usera").
- [ ] **AI: default models setting** — let user pin default model(s).
- [ ] **AI: conditional "Connect" CTA** — show OpenRouter connect button whenever not connected.
- [ ] **AI: in-context instructions/help text** — explain note/card AI features at point of use.
- [ ] **AI: stream generation (perf-audit H3)** — partial notes/cards in ~1–3s instead of a 30–60s opaque spinner.
- [ ] **Test/cleanup debt** (3 items — see bottom): `revalidate-prompt-surfaces.ts` verify-or-delete, prompts E2E, topic-scoped-review E2E.

**Done** (shipped off this backlog)

- [x] Rename app → `eggplant_ai_notes` — `layout.tsx` metadata title + real description (closes perf-audit **L2**). Nav has no wordmark and `/` redirects to `/dashboard`, so metadata was the only name surface.
- [x] Footer — `site-footer.tsx` (carries the Contact dialog).
- [x] Connect external LLM via OpenRouter (BYOK, PKCE) — S-19.
- [x] Create notes from a markdown/any file — S-19 import.
- [x] Create notes by asking AI — S-19 gen-notes/gen-cards.
- [x] Update a note by agent over HTTP (CLI/webhook-style API) — expose-cli-note-api + clc-api-crud-endpoints.
- [x] Settings model picker — sort by price + alphabetical, per-user pins (model-picker-sort-favorites).
- [x] Split `openrouter/prompts.ts` grab-bag — now `prompt-schemas` / `system-prompts` / `build-prompt` / `preview-prompt`.
- [x] ~~Branded loader (bouncing eggplant)~~ — superseded: gradient `Spinner` is the project-wide loader standard.

---

## Details — open items

### Branding / identity

- [ ] Eggplant logo — brand mark for nav/landing/favicon.

### Performance (= roadmap S-11)

- [ ] Caching between route navigations / revalidate strategy. **Real blocker:** Next 16 `'use cache'` can't read cookies, but RLS scopes rows by the auth cookie — must resolve per-user cache keying first. A `staleTimes` stopgap was tried and reverted (no targeted invalidation). In-flight audits: `context/changes/perf-audit-2026-06-10`, `context/changes/query-performance-audit`.

### Later (explicitly deferred)

- [ ] User account page ("konto usera — na później").

### AI / OpenRouter polish

- [ ] Allow setting default model(s) in settings.
- [ ] OpenRouter "Connect" button visible conditionally whenever not connected.
- [ ] AI instructions / help text everywhere the AI features surface.
- [ ] **Stream AI generation (perf-audit H3).** `generate-notes.ts`/`generate-cards.ts` use `generateObject`, which resolves only when the whole object is done → a 30–60s opaque spinner for big inputs (50k chars / 10MB PDF). Switch to `streamObject` + render incrementally (first note in ~1–3s). Not XS: Server Actions don't stream cleanly — intended path is a Route Handler returning a streamed response consumed via `useObject`, touching `note-form.tsx`/`import-panel.tsx` + `GENERATION_TIMEOUT_MS`. Source: `context/changes/perf-audit-2026-06-10/findings.md` (H3).

### Test & code-health debt

- [ ] **Behavioral coverage for `editable-system-prompts`** (deferred at the 2026-06-08 review gate). Unit logic is covered (`user-prompts.test.ts`, `prompts.test.ts`); the DB read (`getResolvedSystemPrompts`), both Save/Reset actions, and dialog wiring still have no behavioral tests. Drive via `/10x-e2e`: save → cross-surface reopen → generate-honors-saved-prompt → reset-confirm → built-in; plus the two-client RLS isolation check.
- [ ] **Verify/fix `revalidate-prompt-surfaces.ts`** (review-gate altitude proposal, 2026-06-08) — it `revalidatePath`s four always-dynamic (`cookies()`) pages, so it may be a no-op. Confirm (Save prompt → navigate to a 2nd surface → new baseline shows with the helper removed) → delete it, or switch to `revalidateTag('user-prompts')` on the data. Also: `systemDefaults` is prop-drilled through 6 wrappers but each dialog reads one key — thin to a string or resolve at the leaf.
- [ ] **E2E for `topic-scoped-review`** (deferred at the 2026-06-09 review gate; unit not high-value — the filter builder is a thin PostgREST wrapper). Drive via `/10x-e2e`: seed cards across two subjects with known due dates → filter `/memory-cards` to subject A → assert the reviewed card belongs to A → rate → assert the next card is also from A → exhaust → `CaughtUpNotice` with the list still present. Archived plan: `context/archive/2026-06-08-topic-scoped-review/plan.md`.

### Loose ideas (unsorted)

- [ ] "Adding notes" onboarding instruction.
- [ ] Update note by agent via webhook — _basic HTTP path shipped (CLI API); a true push/webhook trigger is still an idea._

---

## Suggested sequencing

1. **Branding** (rename + logo) — low-risk, high-visibility.
2. **Mobile pass.**
3. **AI polish** (default models, conditional connect CTA, help text).
4. **Test/cleanup debt** — clear before more features pile on.
5. **Performance** (S-11) — own focused change; has the cache-vs-RLS blocker.
6. **User account page** — last of the deferred set.
