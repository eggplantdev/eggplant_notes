# S-19 AI-Assisted Authoring — Session Handoff (2026-06-07)

Resume point for a fresh session. All 4 phases are **implemented, committed, and automated-verified**;
the slice is **on a branch in a PR, not merged**. This doc is the source of truth for what's left.

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
