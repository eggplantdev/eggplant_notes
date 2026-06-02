<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Repository Guidelines

`coding-learning-companion` — a personal coding-learning web app (markdown notes + spaced-repetition "topic checks"). Stack: Next.js 16 (App Router) + React 19 + TypeScript, Tailwind v4 + shadcn/ui, Supabase (Postgres + Auth + RLS), deployed on Vercel. Solo MVP, hard deadline **2026-06-10**. This is the canonical, cross-tool agent onboarding file; Claude Code inherits it via `@AGENTS.md` in `CLAUDE.md`.

## Hard rules (read first)

- **Use `pnpm`, never `npm`/`npx`.** Lockfile is `pnpm-lock.yaml`; there is no `package-lock.json`, so `npm audit`/`npm ci` fail with `ENOLOCK`. Audit with `pnpm audit --json`; override transitive deps via `overrides` in `@pnpm-workspace.yaml` (pnpm 11 — **not** the old `pnpm.overrides` in `package.json`, which it silently ignores).
- **Next.js 16 ≠ your training data** (see the sentinel above) — verify against `node_modules/next/dist/docs/` before writing routing/rendering code.
- **App Router only.** Server Components by default; add `'use client'` only when needed; fetch data in Server Components; `loading.tsx`/`error.tsx` for streaming/boundaries; route groups `(group)` for organization.
- **Never hand-edit auto-managed sentinel blocks.** `<!-- BEGIN:nextjs-agent-rules -->` here (Next.js) and `<!-- BEGIN @przeprogramowani/10x-cli -->` in `CLAUDE.md` (10x-cli) are rewritten by their tools — edits there are lost on the next run.
- **Env vars on Vercel:** the **Supabase Marketplace integration** is installed and auto-provisioned its keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_*`, …) — scoped to **production + preview only, not development**. Add future services the same way (`vercel env add`), never hand-edit. **Local dev uses a local Supabase stack** (`supabase start`) with its own local keys in `.env.local`, _not_ the hosted prod/preview creds — keeps production secrets off your machine and matches the devcontainer wiring (`host.docker.internal`). So `vercel env pull` (development target) intentionally won't fetch the hosted Supabase vars.
- **Never write to `context/archive/`** — archived changes are immutable.

## Project structure — feature-first, tiered

Organize by **domain**, not by technical type. Tiers, and the one-directional promotion rule between them:

- `src/features/<domain>/` — **domain code lives here; this is the default home.** Each feature owns its `components/`, `actions/`, `schemas.ts`, `types.ts`, hooks. New code is **born here**, inside its feature (e.g. `src/features/auth/`).
- `src/components/` — **non-domain primitives**: `ui/` (shadcn), `forms/` (TanStack `useAppForm` layer). These have **zero domain knowledge** — never put feature logic here, and don't move a feature-only helper here just because it's a component.
- `src/lib/` — **infra/util only, no domain knowledge**: `supabase/` clients, `utils/`. Auth/notes/etc. do **not** belong here (that was the old layout; `lib/auth` → `features/auth`).
- `src/types/` — cross-feature shared `*T` types (e.g. `action.ts`). Co-locate feature-only types in their feature; promote here on the **2nd** consumer.
- `src/hooks/`, `src/stores/` (Zustand) — only genuinely cross-feature ones; feature-scoped hooks/stores stay in the feature.
- **Promotion rule:** keep code in its feature until a **second** feature needs it, _then_ lift it to the shared tier (`src/types/`, `src/components/`, `src/lib/`). Never promote on the first use.
- `src/app/` — App Router routes **only** (Next forces routing here); route files stay thin and import from `features/`. Route groups mirror features (`(auth-pages)` ↔ `features/auth`). API routes under `src/app/api/`.
- `src/__tests__/**/*.test.ts` — Vitest specs.
- `supabase/` — `config.toml` + `migrations/`; every row scoped by `auth.uid()` (RLS).
- `context/foundation/` — `@context/foundation/prd.md` (the contract), `@context/foundation/tech-stack.md`; sprint plan at `@context/changes/v1-sprint-plan/plan.md`.

## Commands

Scripts: `@package.json`. Run `mise install` once (Node 24 + pnpm + the Supabase CLI, pinned in `@mise.toml`). Add UI with `pnpm dlx shadcn@latest add <component>`. The Supabase CLI (`supabase start`, migrations) runs on the **host**, not in the devcontainer — it is **not** an npm dependency; `mise install` provisions it.

## Style & conventions

- Functions under ~20 lines.
- husky + lint-staged auto-run Prettier (`prettier-plugin-tailwindcss` sorts classes) + ESLint (`@eslint.config.mjs`) on staged files pre-commit — formatting/lint is enforced at commit, not just CI.

## Testing

Vitest 4; specs live under `src/__tests__/**/*.test.ts`. Commands in `@package.json`.

## Commits & CI

- Commit style (from `git log`): lowercase imperative subject, no Conventional-Commits prefix — e.g. `add supabase cli dev-dep + fix arm64 binary resolution`.
- CI gate is **Vercel's GitHub integration** (no `.github/workflows/*` in v1): push → preview deploy; merge to `main` → production. Remote: `github.com/ex-Plant/coding-learning-companion` (public).

## pnpm specifics

- `package_manager` is `pnpm` despite the `tech-stack.md` hand-off reading `npm` — it was overridden at bootstrap.
- **pnpm version is pinned to `11.5.1` via `packageManager` in `@package.json`** (pnpm self-manages that exact patch via Corepack-style download — it wins over mise, which is aligned to `pnpm = "11"` in `@mise.toml` for cosmetic consistency). The mise/`packageManager` pins must not drift apart.
- **pnpm 11 reads settings from `@pnpm-workspace.yaml`, not `package.json`'s `"pnpm"` field** (that field is silently ignored). Two settings live there:
  - `overrides` — the postcss security floor (`postcss@<8.5.10 → >=8.5.10`).
  - `allowBuilds` — build-script allowlist that **replaces** v10's `onlyBuiltDependencies`/`ignoredBuiltDependencies` (a map: `esbuild: true`, `msw: false`, `sharp: false`, `unrs-resolver: false`). New deps with build scripts (e.g. a transitive `msw` via `@vitest/mocker`) surface as `ERR_PNPM_IGNORED_BUILDS` until added here with an explicit boolean.
- **No `supportedArchitectures`.** It was once set to force a correct-arch Supabase CLI binary, but the CLI is no longer an npm dep — it's a host-only tool managed by mise (`supabase = "2.101.0"` in `@mise.toml`). Plain pnpm resolves the current platform for `next-swc`/`esbuild`/`sharp`, and Vercel resolves Linux natively at build, so the setting is unnecessary. If you ever add another npm-distributed CLI that ships per-platform binaries and mis-resolves, reintroduce it then — don't add it preemptively.

## Tooling tripwires

- After every `10x get`, the two in-place `/10x-bootstrapper` patches are reverted by upstream — re-apply with `git checkout HEAD -- .claude/skills/10x-bootstrapper/`. The patches: (1) `audit_commands.js` is a pnpm/yarn/bun-keyed map, not the shipped `npm audit` string; (2) the temp scaffold dir is `bootstrap-scaffold` (no leading dot — `create-next-app` rejects dot-prefixed names). Full audit trail: `@context/changes/bootstrap-verification/verification.md`.
- shadcn was init'd `--preset nova` (`radix-nova`, `neutral`). `globals.css` was patched to drop a `--font-sans` circular reference (literal `"Geist"` names, required for Tailwind v4 `@theme inline`). Swap palettes by editing the `@theme inline` / `:root` / `.dark` OKLCH blocks in `src/app/globals.css`; token names stay. Visual tuning: tweakcn.com.
- `wykonczymy` (`/Users/konradantonik/workspace/yolo/wykonczymy`) is a reference repo for tooling/component patterns only (mise, husky, lint-staged, prettier, vitest, ESLint, Zustand/TanStack). **Ignore its Payload CMS layer** — this project uses Supabase. Full guidance: `@context/foundation/reference-repos.md`.

## Vercel (LIVE — scaffold deployed 2026-06-01)

Vercel is the canonical surface for deploys, env, logs, domains, linking. The empty scaffold is already in production; env/services come online as build phases land.

- **Env ritual (once active):** `vercel link` → `vercel env add <NAME>` (per var, pick prod/preview/dev) → `vercel env pull .env.local`. Same for every new service (Supabase, Resend, …). Never `echo >> .env.local` — overwritten on next pull, won't reach preview/prod.
- **Deploys:** `vercel` = preview (also auto-fires on `git push` once GitHub integration is live); `vercel --prod` = production; `vercel logs <url>` / `vercel ls`.
- **First-time setup ritual:** `gh repo create <name> --source=. --private --push` (gh authed as `ex-Plant`) → `vercel link` → `vercel env add` per var → `vercel env pull` → first push triggers preview, merge to `main` triggers prod.
- **Account state (current, 2026-06-01):** CLI user `eggplantdev` (`admin@eggplantdev.com`, hobby plan). Project lives under the **personal** account scope `eggplants-projects-07c20257` (orgId `team_eTY61jJROGLC3P8x6Tvi1doZ`, projectId `prj_jYwukp9E4Qy8uzDbyPfQliNdTvCt`), git-connected to `github.com/ex-Plant/coding-learning-companion`. Live prod alias: `https://coding-learning-companion-theta.vercel.app`. The link is repo-level (`.vercel/repo.json`, not `project.json`). Confirm anytime: `vercel whoami` (expect `eggplantdev`) + `cat .vercel/repo.json` (orgId `team_eTY6…` = personal scope). **Note:** `vercel whoami` returns `Not authorized` if `.vercel/` is stale-linked to a team you can't access — `rm -rf .vercel && vercel link --yes --project coding-learning-companion` (no `--scope`; personal accounts reject `--scope`) fixes both link and whoami.
- **Resolved (2026-06-01):** the old accidental project under the `wykonczymys-projects` team was unlinked/removed; the repo is now solely under the personal scope above. Prod function region switched from `iad1` → `fra1` (EU, Supabase co-location).
- **Config:** prefer typed `vercel.ts` over `vercel.json`. CLI syntax has shifted — use the `vercel-plugin:vercel-cli` skill, not training data.

## Linear (issue tracking)

- MCP connected at project scope (`.mcp.json`, OAuth done); tools are `mcp__linear__*` (load schemas via `ToolSearch` first). Backlog lives in team **`Ex-plant`** (key `EX`), project **`Coding Learning Companion`**. Other workspace projects are personal — leave them alone.
- **`roadmap.md` is the source of truth; Linear mirrors it.** Keep issue status in sync as you work a change: `save_issue` with an `id` (e.g. `EX-359`) updates in place — `state`, `assignee`, `priority`, `labels`, links; `save_comment` for notes.
- **No delete/archive tool** — the MCP is create/read/update only. To drop an issue, set `state` to Canceled; true deletion is a Linear-UI action. Don't fall back to guessing Linear's REST API.
