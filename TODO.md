# Coding Learning Companion — Backlog

> Markdown notes grouped into subjects + spaced-repetition recall cards. Eggplant-branded.
> **The product WORKS** — roadmap S-01..S-10 shipped. This backlog is post-deadline polish + new features, not critical-path.
> _Status snapshot: 2026-06-10._

---

## ✅ At a glance

**Left to do**

- [x] **Eggplant logo** — brand mark for nav / landing (favicon ✅ done). Asset now in `public/logos/eggplant-logo.png`; nav/landing wordmark still open.
- [ ] **Performance / route caching (S-11)** — client Router Cache shipped (`nav-cache-staletimes` Phase 1, `staleTimes.dynamic=300` + nuclear bust); Phase 2 (granular busting) deferred — see Performance detail below.
- [ ] **Mobile pass** — check + fix layouts on small screens.
- [ ] **AI: stream generation (perf-audit H3)** — partial notes/cards in ~1–3s instead of a 30–60s opaque spinner.
- [ ] sort in selects especially topics sort
- [ ] sorting notes by date / time / alphabetically
- [ ] wygląd kart pod notatką - większy padding etc
- [ ] do not close editor after note saved only show toast
- [ ] do not redirect after edit, just edit in place
- [ ] go back works like shit

_Code-health debt ✅ cleared — `systemDefaults` prop-drill fixed (`5e175cc`), `revalidate-prompt-surfaces.ts` deleted, topic-scoped-review E2E done._

supabase connection

Welcome text needs refining
This app is a simple loop: write a note, turn it into memory cards, then review them a little each day. Head to Settings to get started — you can load sample data to explore, or connect an OpenRouter account to generate cards with AI. You can even download a skill that lets an AI agent connect over CLI/HTTP and author notes and cards for you.

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
- [x] topic-scoped-review E2E — `e2e/topic-scoped-review.spec.ts` (filtered review-panel scoping; deliberate-break verified). Test-plan §8 + §6.3.

---

## Details — open items

### Branding / identity

- [x] Eggplant logo — brand mark for nav/landing. Favicon ✅ shipped via `src/app/icon.tsx` (generated from `public/logos/eggplant-logo.png`, mirrors the portfolio repo). Nav/landing wordmark still open.

### Performance (= roadmap S-11)

- [x] **Caching between route navigations — SHIPPED (`nav-cache-staletimes` Phase 1, 2026-06-11).** The felt cost was the per-nav _server round-trip_, not the query (reads already lean) — a _client_ Router Cache problem (per-user in the browser, no RLS/cookie blocker, unlike the `'use cache'` server-cache dead-end). Fix: `experimental.staleTimes.dynamic=300` in `next.config.ts` + a nuclear `revalidatePath('/', 'layout')` on every state-mutating **Server Action** (28). Route-handler busts were dropped as no-ops (all-dynamic app, no server cache + no Router channel to a browser). E2E-verified (`e2e/nav-cache.spec.ts`). Closed audits feeding this: `context/changes/perf-audit-2026-06-10` (CLOSED), `context/changes/query-performance-audit` (RESOLVED — column-slimming done).
- [ ] **Phase 2 — granular per-domain busting (deferred, future).** Replace the nuclear `revalidatePath('/', 'layout')` with per-domain path sets so a write only evicts routes that display the changed data (unrelated routes keep cache hits across writes). Deferred for a solo app: nuclear is correct + simple, writes are infrequent so the only cost is one cold nav after each write, and granular adds a standing **drift liability** (every new route showing a shared read — `getSubjects`/`getDailyGoal`/`getOpenRouterStatus` — must be hand-added to a path set or it silently goes stale). Full design + gap map: `context/changes/nav-cache-staletimes/design.md` (§Phase 2 + gap map) and `handoff.md`. Revisit only at real multi-user traffic.

### AI / OpenRouter polish

- [ ] **Stream AI generation (perf-audit H3).** `generate-notes.ts`/`generate-cards.ts` use `generateObject`, which resolves only when the whole object is done → a 30–60s opaque spinner for big inputs (50k chars / 10MB PDF). Switch to `streamObject` + render incrementally (first note in ~1–3s). Not XS: Server Actions don't stream cleanly — intended path is a Route Handler returning a streamed response consumed via `useObject`, touching `note-form.tsx`/`import-panel.tsx` + `GENERATION_TIMEOUT_MS`. Source: `context/changes/perf-audit-2026-06-10/findings.md` (H3).
- [ ] **Generation rate limiter (nice-to-have — NOT building now).** Caps repeat/loop calls on `generateNotes`/`generateCards`; token-bucket/fixed-window keyed on `auth.uid()`, checked at the action entry _before_ key-decrypt + DB reads. Shelved on purpose: the per-request size cap already exists + is tested (`generate-caps.test.ts`); BYOK means a loop burns the user's _own_ OpenRouter credits, so this protects mainly _our_ Vercel/Supabase load + accidental self-harm, not a money leak. Worth it only at a second user / real traffic. Closes the R4 loop dimension recorded in `context/foundation/test-plan.md` §2. Build = Upstash Redis + `@upstash/ratelimit` + a loop-guard test.

### Sample data UX

- [ ] **Make wipe-then-load atomic (follow-up to `c0a5400`).** The shipped `loadSampleData` wipes existing content (`deleteAllUserContent`) then seeds across separate supabase-js calls — not one transaction. If a seed insert fails _after_ the wipe succeeds, the user's data is gone and the `is_seeded` rollback can't restore it. Fix = do wipe+seed inside one Postgres transaction via an RPC (the pattern `delete_account` uses). Low priority: the seed payload is a fixed, validated fixture that has always inserted cleanly, so the failure window is narrow.

### Test & code-health debt

- [x] **`revalidate-prompt-surfaces.ts` — DELETED (2026-06-10, `13db3a6`).** Verified a no-op: the four paths are dynamic (Supabase `cookies()`), supabase-js reads aren't Data-Cached, and Next 16 `staleTimes.dynamic=0` (no override) means dynamic pages refetch on soft-nav — nothing for `revalidatePath` to bust. Confirmed by a Playwright probe (out-of-band `user_prompts` change reflected after soft-nav, no revalidate). `revalidateTag` would also be a no-op (no tagged Data-Cache entry). Full record: `context/changes/revalidate-prompt-surfaces/handoff.md`.
- [x] **`systemDefaults` prop-drill — FIXED (`5e175cc`).** Replaced the drill with `PromptDefaultsProvider` context (`prompt-defaults-context.tsx`): the page sets it once, `GenerateDialog` reads its one key via `usePromptDefault` — intermediate wrappers no longer carry it. (Siblings `aiEnabled`/`defaultModel` still pass through `MemoryCardsSection`→`GenerateCardsButton`, but that's a thin, stable chain — left as-is.)
- [x] **E2E for `topic-scoped-review`** — shipped `e2e/topic-scoped-review.spec.ts` (2026-06-10): two subjects, an "intruder" global-soonest card in B; filter to A and assert B never surfaces + the panel's due-count subtitle tracks the filtered queue (3→2→1→caught-up) with the list surviving. Deliberate-break verified. Archived plan: `context/archive/2026-06-08-topic-scoped-review/plan.md`; test-plan §8 + §6.3.

### Code-quality / refactor debt (open)

> Surfaced while building the post-action loader work (`908ec33`). All three are about how the app
> represents **mutation state + feedback** — currently three overlapping ad-hoc mechanisms. Worth a
> single review pass that picks one pattern per concern, not piecemeal fixes.

- [ ] **Form error handling — TanStack vs `useState`.** Two competing patterns: most forms route errors
      through `useFormError`/`reportResult` (toast on success, inline on failure), but some hand-roll a bare
      `useState<string>()` (`src/app/(auth-pages)/update-password/page.tsx`, `import-panel.tsx`). Pick one —
      ideally a single form-result seam every Server-Action form uses — so error display is uniform and the
      TanStack form owns its own error state instead of a parallel `useState`.
- [ ] **`useActionTransition` Promise-bridge is unreadable.** `src/hooks/use-action-transition.ts` wraps a
      manual `new Promise` + `resolve(result)` inside `startTransition` only to (a) keep `isPending` true
      through the action/navigation while (b) returning the result to the caller. In-code `TODO` already
      marks it. Replace with a clearer primitive (`Promise.withResolvers` or a small `Deferred`).
- [ ] **Pending buttons scattered instead of a loading convention.** Nearly every mutation surface
      hand-rolls its own `disabled={isSubmitting || isNavigating}` + "Saving…" label (`note-form`,
      `subject-form`, `card-form`, the delete dialogs, `import-panel`, `update-password`). No shared
      pending-button primitive and no clear rule for when to use a button-pending state vs the route's
      `loading.tsx`. Consolidate: one pending-button component + a documented "inline-pending vs route-loader"
      boundary.

### Loose ideas (unsorted)

- [ ] "Adding notes" onboarding instruction.
- [ ] Update note by agent via webhook — _basic HTTP path shipped (CLI API); a true push/webhook trigger is still an idea._

---

## Future plans (nice-to-have)

- [ ] **User account page** ("konto usera — na później"). Deferred — not on the current path.
- [ ] **Landing page** — public marketing/intro page (currently `/` redirects straight to `/dashboard`).

---

## Suggested sequencing

1. **Branding** (rename + logo) — low-risk, high-visibility.
2. **Mobile pass.**
3. **AI polish** — only **stream generation (H3)** left; default-model, conditional connect CTA, and help text are shipped.
4. **Test/cleanup debt** — clear before more features pile on.
5. **Performance** (S-11) — own focused change; has the cache-vs-RLS blocker.
