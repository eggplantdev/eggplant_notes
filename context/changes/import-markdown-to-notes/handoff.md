# S-19 AI-Assisted Authoring — Session Handoff (2026-06-07)

> **Session 3 update (2026-06-07) — Phase 6 done + Phase 7 mostly done, ON A NEW BRANCH IN THE MAIN
> CHECKOUT. Read this block first; Session 2 (Phase 5) and the original Phase 1–4 handoff follow below.**
>
> ### ⚠️ Topology changed — work left the worktree
>
> - Work moved OFF the worktree (`feat/ai-assisted-authoring`, PR #1) onto **`feat/ai-authoring-iter2`
>   in the MAIN checkout** (`/Users/konradantonik/workspace/10x_devs`). Resume there with a plain
>   `git`/`cd` — do NOT use the worktree for this work anymore. The worktree still exists (plan-author
>   branch); leave it.
> - `feat/ai-authoring-iter2` was branched off `feat/ai-assisted-authoring` HEAD (so it has phases 1–5
>   - the iteration-2 plan `b613864`). **It has DIVERGED from PR #1** — reconcile later (merge iter2
>     into the PR branch, or repoint the PR). Not yet decided.
> - **Shared branch:** a parallel agent is also committing to `feat/ai-authoring-iter2` (a
>   `MemoryCardsField`/`SettingsSection` extraction — commits `5246218`, `4a595d0`). Their note-form
>   refactor landed AND carried my `promptOverride` one-liner. Check `git log` before assuming a file
>   is yours; stage by explicit path only.
> - **Env:** the main checkout's `.env.local` now has `OPENROUTER_ENC_KEY` (appended from the worktree).
> - The `w-fit` file-input fix exists twice: `f8bc9be` on `main` (Phase-1 import) and again in `cda9100`
>   on this branch — both intentional; this branch never had the main-only fix.
>
> ### What shipped this session (all on `feat/ai-authoring-iter2`, green: typecheck/lint/build)
>
> - **Phase 6 — Live model catalog (DONE):** `6a99f7e` (catalog + searchable combobox + pricing),
>   `67c240f` (unit test: normalize/filter), `1b597e0` (picker full-width + alphabetical), `9ad6884`
>   (progress). New: `catalog.ts` (server-only `unstable_cache` `/models` fetch + curated fallback +
>   async `isAllowedModel`), `actions/list-models.ts` (client bridge), reworked `models.ts`
>   (`RECOMMENDED_MODELS`, pure `normalizeModels`/`filterModels`/`formatPricePerM`), combobox
>   `model-select.tsx` (lazy fetch-on-open, `filter='text'|'file'` for Phase 8). `server-client.ts`/
>   `set-model.ts` validate against the live catalog (async).
> - **Phase 7 #1+#2 — editable dialog (DONE):** `d859d09`. `promptOverrideSchema` in `prompts.ts`;
>   `generateCards`/`generateNotes` take optional `promptOverride` (replaces the built prompt + grounded
>   re-fetch; sent+logged verbatim). Dialog widened (`sm:max-w-3xl`), read-only `<pre>` → editable
>   System+Prompt `<Textarea>`s + "Reset to default"; sends override ONLY when edited. Signature
>   `(modelId, promptOverride?)` threaded through topic-generator/generate-cards-button/card-form/
>   note-form/import-panel.
> - **Phase 7 #4 — import UX + nav (DONE):** `cda9100`. Explanation moved under the header + rewritten
>   as a plain two-path summary; file-input `w-fit`; **Import removed from nav** → outline buttons on
>   the Notes and Subjects pages (both link `/import`).
>
> ### What's NOT done
>
> - **Phase 7 #3 — topic input INTO the dialog** (collapse `TopicGenerator` to a trigger; dialog owns
>   the source `<textarea>`, Shape A). DEFERRED for a note-form collision that has since CLEARED — now
>   unblocked. This is the only remaining Phase 7 item; it's an optional unification (topic-gen already
>   works). Plan rows 7.4 still open.
> - **Phase 8 — PDF via vision.** Untouched. (Phase 6 already shipped the `filter='file'` hook it needs.)
> - **Manual verification:** 6.2 (off-list guard — no unit test, `catalog.ts` is server-only; verify
>   with a live catalog + key), 6.5/6.6 (settings picker searchable/priced/persists; catalog is current),
>   7.1/7.3 (edited prompt is sent+logged; reset works), 7.6 (headingless paste still auto-shows a
>   "Preview — 1 note" — NOT changed; operator didn't ask, revisit if wanted).
> - **Tests:** only `src/__tests__/openrouter-models.test.ts` added. No new E2E. Phase 5 unit tests
>   (5.1–5.3) from the prior handoff are still unwritten.
>
> ### Resume checklist
>
> 1. `cd /Users/konradantonik/workspace/10x_devs`, `git checkout feat/ai-authoring-iter2` (it may be
>    current). Confirm `.env.local` has `OPENROUTER_ENC_KEY`.
> 2. Decide: do Phase 7 #3, then Phase 8 — or reconcile `feat/ai-authoring-iter2` ↔ PR #1 first.
> 3. Plan Progress updated for Phase 6 (6.1/6.3/6.4) + Phase 7 (7.2/7.5) on this branch; flip the rest
>    as they verify.
> 4. Then the full slice gate (review → simplify → tests → archive) and the deferred merge/Linear steps.
>
> ---

> **Session 2 update (2026-06-07) — Phase 5 added. Read this block first; the original Phase 1–4
> handoff follows unchanged below.**
>
> ### What happened this session
>
> - **Phase 5 (per-generate model select + always-on prompt/token debug) was planned, implemented,
>   reviewed, and `/simplify`'d.** Plan: `plan.md` "## Phase 5" + design doc
>   `model-select-and-prompt-debug-design.md`. Capabilities: a model `<Select>` in the generate
>   **dialog** (per-generate override) + in **/settings** (persisted default); the exact prompt shown
>   pre-generate; token counts after; an always-on debug log (`console` + best-effort `.ai-debug/*.jsonl|md`).
>   Model resolution: per-generate override → `credential.model` (settings) → `DEFAULT`.
> - **A stopped agent's AI-button/gate stream was folded in** (always-render AI triggers + connect-gate-
>   on-click, nav connect button, `ai` Button variant). Its review doc: `follow-ups/ai-button-gate-review.md`.
> - **Review gate ran on the combined slice:** 4-check fan-out → triage → `/simplify`. Findings applied:
>   AG-1/2/3 (shared `ConnectOpenRouterButton`, hook moved to feature root, nested-form guard), F1/F2/F3,
>   and accepted proposals AG-5 (one `getOpenRouterStatus()` per page), ALT-2 (log dir → stable
>   `.ai-debug/`), ALT-3/EFF-F2 (preview is pure in `prompts.ts`, `preview-prompt` action deleted,
>   redundant `getNote` + `openrouter→notes` edge removed). Deferred: ALT-1/4 (owner folding into incoming
>   work), F3/F5/AG-8 in `follow-ups/review-fixes.md`.
>
> ### Phase 5 commits — ⚠️ LOCAL ONLY, NOT PUSHED (3 ahead of origin)
>
> ```
> 337b807 refactor: Phase 5 review-gate cleanup (simplify + findings)
> 10c699d refactor: apply AI-button-gate review findings AG-1/2/3
> de77700 feat: model select + prompt/token visibility + always-render connect gate (p5)
> ```
>
> PR #1 still shows only up to `32ab1ff`. **First resume step: `git push` (in the worktree) so the PR
> reflects Phase 5 and the work is safe.** (Not pushed this session — push wasn't requested.)
>
> ### Gate status: review ✅ → simplify ✅ → committed ✅ → **tests + archive HELD**
>
> Held deliberately — owner has "many more changes incoming" to this slice, so the test layer waits
> until the code settles (writing specs now would lock in code about to move).
>
> ### Phase 5 resume checklist (when incoming changes land)
>
> 1. `git push` the 3 commits (do this first regardless).
> 2. Land the owner's incoming changes (see `iteration-2-braindump.md` — owner's notes, hands-off this session).
> 3. Author tests `5.1–5.3` (plan Progress): shared-builder preview==sent, off-list model (ignored by
>    `getOpenRouterModel`, rejected by `setOpenRouterModel`), `setOpenRouterModel` persist/read round-trip.
> 4. Manual `5.5–5.8` (model picker persists; 4 dialogs pre-select tagged default + show prompt+tokens;
>    `.ai-debug` logs accrue; AI surfaces render-when-disconnected and open the connect gate — NOTE the
>    addendum AG-4 reversal of the old "hidden when disconnected" criteria).
> 5. Full suite → `/10x-archive` → then the Phase 1–4 merge/Linear steps below.
>
> ### Phase 5 verification done this session
>
> typecheck + lint + build green on every commit. NOT manually verified end-to-end on a connected
> account (Playwright seed account isn't OpenRouter-connected; owner verifying on their own session).
> Phase-5 unit tests not yet written (held).
>
> ---

Resume point for a fresh session. All 4 phases are **implemented, committed, and automated-verified**;
the slice is **on a branch in a PR, not merged**. This doc is the source of truth for what's left.
(The Phase 1–4 content below predates Phase 5 — still accurate for those phases.)

## Where the work lives

- **Branch:** `feat/ai-assisted-authoring`
- **Worktree:** `/Users/konradantonik/workspace/10x_devs/.claude/worktrees/ai-authoring`
  (its own `node_modules` + `.env.local` incl. a dev `OPENROUTER_ENC_KEY`; created off local `main` HEAD).
- **PR:** https://github.com/ex-Plant/coding-learning-companion/pull/1 (base `main`, head `feat/ai-assisted-authoring`)
- **Resume in the worktree** — do NOT `git checkout` in the main repo (shared HEAD; a parallel session
  uses it). Either `cd` to the worktree path, or `EnterWorktree path=.claude/worktrees/ai-authoring`.

## What shipped (the 5 capabilities)

Two AI primitives × grounded/ungrounded + one deterministic op:

|               | Grounded (source)          | Ungrounded (topic)           |
| ------------- | -------------------------- | ---------------------------- |
| gen-notes     | #3 doc/prose → N notes     | #5 topic → 1 note            |
| gen-cards     | #1 note → cards            | #2 topic → 1 standalone card |
| split (no AI) | #4 structured md → N notes | —                            |

All AI gated behind OpenRouter BYOK (OAuth PKCE), key AES-256-GCM at rest. Every AI output is
preview/edit-gated before commit.

## Commits

- `4650dfc` Phase 1 deterministic import — **on `main` already** (base of the PR, not in its diff)
- `2f9679f` Phase 2 OpenRouter connect (PKCE + AES-GCM + curated models + /settings)
- `618614f` Phase 3 gen-cards (#1 note, #2 topic)
- `3dda271` Phase 4 gen-notes (#3 decompose, #5 topic)
- `d448ad2` epilogue (plan Progress SHA write-back)
- `76eeda5` review-gate cleanups

## Verified green

`pnpm typecheck` / `lint` / `test` (124 unit: splitter, AES-GCM round-trip+tamper, AI schemas) /
`build`; Phase-1 import E2E. Migration applies; `openrouter_credentials` RLS own-only + FK-cascade to
`auth.users` confirmed via pg_catalog.

## NEXT STEPS (priority order)

1. **Set `OPENROUTER_ENC_KEY` on Vercel** (prod + preview) — `vercel env add OPENROUTER_ENC_KEY`
   (fresh 32-byte base64). **Blocks all AI on the deploys** until set; deterministic import works without it.
2. **Manual verification** (these Progress rows are still `[ ]` in `plan.md`):
   - 1.7–1.10 (import: real file, oversized cap, paste, no regression)
   - 2.5–2.7 (live OAuth connect, disconnect, account-delete removes credential)
   - 3.5–3.7, 4.5–4.7 (AI card/note quality, gating hidden when not connected)
   - 3.4 / 4.4 E2E stay **manual** (need a mock OpenRouter server; live AI can't run deterministically in E2E).
   - Test in the worktree: `cd <worktree> && pnpm dev -p 3001`, connect a real OpenRouter account at `/settings`.
3. **Merge PR #1 → main.**
4. **After merge (the slice is NOT done until this lands):**
   - `/10x-archive import-markdown-to-notes`
   - `roadmap.md ## Done` entry (auto via archive) — S-19 row is currently `planned`, flip narrative
   - **Linear:** no EX issue exists for S-19 yet (CLAUDE.md map stops at S-17 EX-385) — create one, set Done
   - Tear down the worktree: `ExitWorktree` (keep or remove the branch)
5. **Deferred review findings** → `context/changes/import-markdown-to-notes/follow-ups/review-fixes.md`:
   - **F3** OAuth `state` CSRF param (confirm OpenRouter echoes `state` first)
   - **F5** hard note-ownership check in `create-cards-for-note.ts` + the pre-existing `create-memory-card.ts`
   - These are a **separate change**, not S-19.

## Key file map

- Deterministic import: `src/features/import/**` (split-markdown.ts util, import-panel/source-input/note-preview-list, import-notes action)
- OpenRouter: `src/features/openrouter/**` (pkce.ts, server-client.ts, models.ts, queries.ts, ai-schemas.ts, types.ts, actions/{connect,disconnect,generate-cards,generate-notes}, components/{connect-card,topic-generator})
- gen-cards UI lives in **memory-cards** (moved in review): `src/features/memory-cards/components/generate-cards-button.tsx`, `actions/create-cards-for-note.ts`
- Crypto: `src/lib/crypto/aes-gcm.ts` (server-only, lazy `OPENROUTER_ENC_KEY`)
- Callback route: `src/app/api/openrouter/callback/route.ts`
- Migrations: `20260607151500_import_notes_rpc.sql`, `20260607153000_openrouter_credentials.sql`
- New deps: `ai`, `@openrouter/ai-sdk-provider`

## Gotchas

- Shared local Supabase (one stack for main + worktree); `db reset` wipes both.
- `TopicGenerator` (openrouter/components) is the shared #2/#5 control; `GenerateResultT` lives in `openrouter/types.ts`.
- ai SDK is **v6**; `generateObject` from `ai` is used (works in v6).
- The OAuth callback origin is derived from the request (works on preview/e2e ports), not static SITE_URL.
- Plan/brief/change: `context/changes/import-markdown-to-notes/{plan,plan-brief,change}.md`.
