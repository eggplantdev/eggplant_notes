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
- [ ] **AI: stream generation (perf-audit H3)** — partial notes/cards in ~1–3s instead of a 30–60s opaque spinner.
- [ ] **Test/cleanup debt** (2 items — see bottom): `revalidate-prompt-surfaces.ts` verify-or-delete, topic-scoped-review E2E.

**Done** (shipped off this backlog)

- [x] Rename app → `eggplant_ai_notes` — `layout.tsx` metadata title + real description (closes perf-audit **L2**). Nav has no wordmark and `/` redirects to `/dashboard`, so metadata was the only name surface.
- [x] Footer — `site-footer.tsx` (carries the Contact dialog).
- [x] Connect external LLM via OpenRouter (BYOK, PKCE) — S-19.
- [x] AI: default model setting — `settings-model-select.tsx` + `set-model.ts` persist `model` on `openrouter_credentials`; `getOpenRouterStatus` returns `defaultModel`. Distinct from favorites/pins.
- [x] AI: conditional "Connect" CTA — `connect-card.tsx` shows `ConnectOpenRouterButton` only when `!connected`; `use-ai-gate.tsx` gates AI triggers with `ConnectGateDialog` when disconnected.
- [x] AI: in-context help text — copy across `generate-dialog.tsx`, `import-panel.tsx`, `connect-gate-dialog.tsx`, `settings-model-select.tsx`, `generate-cards-button.tsx`.
- [x] Create notes from a markdown/any file — S-19 import.
- [x] Create notes by asking AI — S-19 gen-notes/gen-cards.
- [x] Update a note by agent over HTTP (CLI/webhook-style API) — expose-cli-note-api + clc-api-crud-endpoints.
- [x] Sample data into a non-empty account — wipe-then-load behind a current-password ceremony (`load-sample-data-dialog.tsx`); empty accounts keep the one-click path. Commit `c0a5400`.
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

- [ ] **Stream AI generation (perf-audit H3).** `generate-notes.ts`/`generate-cards.ts` use `generateObject`, which resolves only when the whole object is done → a 30–60s opaque spinner for big inputs (50k chars / 10MB PDF). Switch to `streamObject` + render incrementally (first note in ~1–3s). Not XS: Server Actions don't stream cleanly — intended path is a Route Handler returning a streamed response consumed via `useObject`, touching `note-form.tsx`/`import-panel.tsx` + `GENERATION_TIMEOUT_MS`. Source: `context/changes/perf-audit-2026-06-10/findings.md` (H3).
- [ ] **Generation rate limiter (nice-to-have — NOT building now).** Caps repeat/loop calls on `generateNotes`/`generateCards`; token-bucket/fixed-window keyed on `auth.uid()`, checked at the action entry _before_ key-decrypt + DB reads. Shelved on purpose: the per-request size cap already exists + is tested (`generate-caps.test.ts`); BYOK means a loop burns the user's _own_ OpenRouter credits, so this protects mainly _our_ Vercel/Supabase load + accidental self-harm, not a money leak. Worth it only at a second user / real traffic. Closes the R4 loop dimension recorded in `context/foundation/test-plan.md` §2. Build = Upstash Redis + `@upstash/ratelimit` + a loop-guard test.

### Sample data UX

- [ ] **Make wipe-then-load atomic (follow-up to `c0a5400`).** The shipped `loadSampleData` wipes existing content (`deleteAllUserContent`) then seeds across separate supabase-js calls — not one transaction. If a seed insert fails _after_ the wipe succeeds, the user's data is gone and the `is_seeded` rollback can't restore it. Fix = do wipe+seed inside one Postgres transaction via an RPC (the pattern `delete_account` uses). Low priority: the seed payload is a fixed, validated fixture that has always inserted cleanly, so the failure window is narrow.

### Test & code-health debt

- [ ] **Verify/fix `revalidate-prompt-surfaces.ts`** (review-gate altitude proposal, 2026-06-08) — it `revalidatePath`s four always-dynamic (`cookies()`) pages, so it may be a no-op. Confirm (Save prompt → navigate to a 2nd surface → new baseline shows with the helper removed) → delete it, or switch to `revalidateTag('user-prompts')` on the data. Also: `systemDefaults` is prop-drilled through 6 wrappers but each dialog reads one key — thin to a string or resolve at the leaf.
- [ ] **E2E for `topic-scoped-review`** (deferred at the 2026-06-09 review gate; unit not high-value — the filter builder is a thin PostgREST wrapper). Drive via `/10x-e2e`: seed cards across two subjects with known due dates → filter `/memory-cards` to subject A → assert the reviewed card belongs to A → rate → assert the next card is also from A → exhaust → `CaughtUpNotice` with the list still present. Archived plan: `context/archive/2026-06-08-topic-scoped-review/plan.md`.

### Loose ideas (unsorted)

- [ ] "Adding notes" onboarding instruction.
- [ ] Update note by agent via webhook — _basic HTTP path shipped (CLI API); a true push/webhook trigger is still an idea._

---

## Suggested sequencing

1. **Branding** (rename + logo) — low-risk, high-visibility.
2. **Mobile pass.**
3. **AI polish** — only **stream generation (H3)** left; default-model, conditional connect CTA, and help text are shipped.
4. **Test/cleanup debt** — clear before more features pile on.
5. **Performance** (S-11) — own focused change; has the cache-vs-RLS blocker.
6. **User account page** — last of the deferred set.
