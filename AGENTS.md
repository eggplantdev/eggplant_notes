<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Repository Guidelines

`coding-learning-companion` — a personal coding-learning web app (markdown notes + spaced-repetition "topic checks"). Stack: Next.js 16 (App Router) + React 19 + TypeScript, Tailwind v4 + shadcn/ui, Supabase (Postgres + Auth + RLS), deployed on Vercel. Solo MVP, hard deadline **2026-06-10**. This is the canonical, cross-tool agent onboarding file; Claude Code inherits it via `@AGENTS.md` in `CLAUDE.md`.

## Hard rules (read first)

- **Use `pnpm`, never `npm`/`npx`.** Lockfile is `pnpm-lock.yaml`; there is no `package-lock.json`, so `npm audit`/`npm ci` fail with `ENOLOCK`. Audit with `pnpm audit --json`; override transitive deps via `pnpm.overrides` in `@package.json`.
- **Next.js 16 ≠ your training data** (see the sentinel above) — verify against `node_modules/next/dist/docs/` before writing routing/rendering code.
- **App Router only.** Server Components by default; add `'use client'` only when needed; fetch data in Server Components; `loading.tsx`/`error.tsx` for streaming/boundaries; route groups `(group)` for organization.
- **Never hand-edit auto-managed sentinel blocks.** `<!-- BEGIN:nextjs-agent-rules -->` here (Next.js) and `<!-- BEGIN @przeprogramowani/10x-cli -->` in `CLAUDE.md` (10x-cli) are rewritten by their tools — edits there are lost on the next run.
- **Env vars on Vercel:** the **Supabase Marketplace integration** is installed and auto-provisioned its keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_*`, …) — scoped to **production + preview only, not development**. Add future services the same way (`vercel env add`), never hand-edit. **Local dev uses a local Supabase stack** (`supabase start`) with its own local keys in `.env.local`, _not_ the hosted prod/preview creds — keeps production secrets off your machine and matches the devcontainer wiring (`host.docker.internal`). So `vercel env pull` (development target) intentionally won't fetch the hosted Supabase vars.
- **Never write to `context/archive/`** — archived changes are immutable.

## Project structure

- `src/app/` — routes (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`); API routes under `src/app/api/`.
- `src/components/ui/` — shadcn components. `src/hooks/`, `src/stores/` (Zustand), `src/lib/`, `src/types/` (shared `*T` types).
- `src/__tests__/**/*.test.ts` — Vitest specs.
- `supabase/` — `config.toml` + `migrations/`; every row scoped by `auth.uid()` (RLS).
- `context/foundation/` — `@context/foundation/prd.md` (the contract), `@context/foundation/tech-stack.md`; sprint plan at `@context/changes/v1-sprint-plan/plan.md`.

## Commands

Scripts live in `@package.json`. Most-used: `pnpm dev` (Turbopack), `pnpm build`, `pnpm lint`, `pnpm typecheck` (`tsc --noEmit`), `pnpm test` / `pnpm test:watch`, `pnpm format:fix`. Run `mise install` once (Node 24, pinned in `mise.toml`). Add UI with `pnpm dlx shadcn@latest add <component>`.

## Style & conventions

- TypeScript strict. Prefer `type` over `interface`; suffix shared types with `T` (`UserT`); avoid `any` and `enum` (use `as const` maps); prefer `undefined` over `null` with `?.`/`??`.
- Naming: files `kebab-case`, components `PascalCase`, functions/vars `camelCase`, env vars `UPPERCASE`, booleans with `is`/`has`.
- Functional/declarative; avoid classes; early returns; functions under ~20 lines. Named exports, one component per file, `function` keyword for components.
- State via Zustand selectors (`useStore((s) => s.x)`, not destructuring). Forms: TanStack Form + Zod. Avoid `useEffect`.
- Prettier 3 (`prettier-plugin-tailwindcss` sorts classes) + ESLint 9 flat config (`@eslint.config.mjs`) enforce formatting/lint; husky + lint-staged run them pre-commit.

## Testing

Vitest 4. Specs under `src/__tests__/**/*.test.ts`. All: `pnpm test`; single file: `pnpm test <path>`; coverage: `pnpm test:coverage`.

## Commits & CI

- Commit style (from `git log`): lowercase imperative subject, no Conventional-Commits prefix — e.g. `add supabase cli dev-dep + fix arm64 binary resolution`.
- CI gate is **Vercel's GitHub integration** (no `.github/workflows/*` in v1): push → preview deploy; merge to `main` → production. Remote: `github.com/ex-Plant/coding-learning-companion` (public).

## pnpm specifics

- `package_manager` is `pnpm` despite the `tech-stack.md` hand-off reading `npm` — it was overridden at bootstrap.
- `pnpm.supportedArchitectures` is set (`os: [darwin, linux]`, `cpu: [arm64, x64]`). Without it, pnpm pulled a wrong-arch Supabase CLI binary (`@supabase/cli-darwin-x64` on an arm64 Mac → `No matching Supabase CLI binary found for darwin-arm64`). Keep it when adding other CLIs that ship platform-specific binaries.

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
