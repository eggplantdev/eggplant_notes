<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Repository Guidelines

`coding-learning-companion` — a personal coding-learning web app (markdown notes + spaced-repetition "memory cards"), deployed on Vercel. Solo MVP. Full stack/versions in `@package.json`. This is the canonical, cross-tool agent onboarding file; Claude Code inherits it via `@AGENTS.md` in `CLAUDE.md`.

> **⚠ Most-broken rule — consult before writing code:** _where_ any new file, component, hook, type, or helper goes is decided by the **`feature-first-structure`** skill. Invoke it; don't guess placement. The project-specific placement facts the skill can't know are under **Project structure** below.

## STOP if you can't run what this file references

This file assumes **Claude Code** — it names skills, slash-commands, and tools other agents may not have. If a step references a skill, command, or tool you don't have access to: do **not** improvise a substitute, skip it silently, or guess an equivalent. **Stop, name the missing capability and what you were about to do, and wait for the human.**

## Hard rules (read first)

- **Use `pnpm`, never `npm`/`npx`** — there's no `package-lock.json`, so `npm ci`/`npm audit` fail with `ENOLOCK`. Audit with `pnpm audit --json`. Override transitive deps via `overrides` in `@pnpm-workspace.yaml` — **not** `pnpm.overrides` in `package.json` (pnpm 11 silently ignores that). New deps with build scripts must be allow-listed in `allowBuilds` there, or install fails with `ERR_PNPM_IGNORED_BUILDS`.
- **App Router only**
- **Never hand-edit auto-managed sentinel blocks.** `<!-- BEGIN:nextjs-agent-rules -->` here (Next.js) and `<!-- BEGIN @przeprogramowani/10x-cli -->` in `CLAUDE.md` (10x-cli) are rewritten by their tools — edits there are lost on the next run.
- **Env vars on Vercel:** the **Supabase Marketplace integration** is installed and auto-provisioned its keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_*`, …) — scoped to **production + preview only, not development**. Add future services the same way (`vercel env add`), never hand-edit. **Local dev uses a local Supabase stack** (`supabase start`) with its own local keys in `.env.local`, _not_ the hosted prod/preview creds — keeps production secrets off your machine and matches the devcontainer wiring (`host.docker.internal`). So `vercel env pull` (development target) intentionally won't fetch the hosted Supabase vars.
- **Env is build-time-validated + server-isolated — not a single `env.ts`.** `next.config.ts` validates env at build start (via jiti), so a missing/malformed var fails `next build`, not just runtime. This includes the SMTP vars `EMAIL_HOST` / `NEXT_PUBLIC_EMAIL_USER` / `EMAIL_PASS` / `EMAIL_TO` — they must be `vercel env add`'d to **preview + prod** (and present in `.env.local` for local builds) or the build fails at config load. Public vars live in `@src/lib/env.ts` (client-reachable); server secrets in `@src/lib/env.server.ts` (`import 'server-only'`) — **never put a server var in `env.ts`** (it poisons the client bundle); shared Zod schemas in `@src/lib/env-schema.ts`. Why → `@context/foundation/lessons.md` ("Build-time env validation … 3-file split + jiti").
- **Never write to `context/archive/`** — archived changes are immutable.

## Project structure — project-specific facts

The feature-first **decision procedure** — the tiers, the promotion rule, the deletion test, Route-Handler-vs-Server-Action, all `.tsx` in `components/` (incl. `*-form` / `delete-*-dialog`), no feature-root barrel, purpose-named `utils/` over a catch-all — lives in the **`feature-first-structure`** skill, whose own Next.js + Supabase example mirrors this repo. Consult it for _where a file goes_ — including type placement (a component's own contract types colocate with it; only cross-cutting types live in `src/types/`). Type naming (`*T`) is in the global `typescript.md` rule. Only the facts neither source can know live here:

- **`container-shell` `@utility`** (`globals.css`, max-w 120rem) is the one source for page width/padding — used by both the nav bar and `PageShell`'s `<main>`. Reuse it; never re-roll `mx-auto max-w-* px-*`.
- Shared primitives that already exist — reach for these before building: `components/layout/PageShell`, `components/forms/` (TanStack `useAppForm`), `components/app-nav/`, `src/stores/` (Zustand, cross-feature only).
- **Loaders use the gradient `Spinner`** (`@src/components/ui/spinner.tsx`, brand green→cyan ring) — never `bg-muted`/`animate-pulse` skeletons. Applies to inline, button, and `next/dynamic` `loading:` states.
- **`framer-motion` stays — don't re-propose removing it for CSS.** Stripping it from `PageShell`/lists/toggles (perf-audit H1/H2) is a deliberate won't-do; rationale + the rest of the audit live in `@context/changes/perf-audit-2026-06-10/` (`STATUS.md` = open/closed list).
- `supabase/` — `config.toml` + `migrations/`; every row scoped by `auth.uid()` (RLS).
- Foundation docs: `@context/foundation/prd.md`, `@context/foundation/tech-stack.md`.

## API contract — three surfaces move together

The token HTTP API (`src/app/api/{subjects,notes,memory-cards}/**`) has **three consumers that must change in lockstep**. Touching a route, payload shape, or data-layer rule (e.g. reshaping the subjects API) means updating all three in the same change:

- **In-app UI ↔ route handlers** — both call the shared `*-core.ts` mutation modules (`src/features/{notes,memory-cards,subjects}/*-core.ts`). Put new mutation/validation logic there, never in one surface only, so a Server Action can't drift from its API route.
- **The downloadable agent skill** — `GET /api/skill` serves the `clc-note-api` skill that documents the whole API to external agents. Its source of truth is `@context/changes/cli-token-ui-and-skill-download/clc-note-api.skill.md`; `@src/features/api-tokens/skill-template.ts` is a **byte-exact generated mirror** — edit the `.md`, then regenerate via its `gen-skill-template.mjs` (steps in the `.ts` header). `@src/__tests__/skill-template.test.ts` only pins the placeholder + endpoint list, so **semantic drift** (field rules, cascades, status codes, new endpoints) ships a _lying_ skill silently unless you update that prose yourself.

## Commands

Scripts: `@package.json`. Run `mise install` once to provision the toolchain (`@mise.toml`). The Supabase CLI (`supabase start`, migrations) runs on the **host**, not in the devcontainer — it is **not** an npm dependency; `mise install` provisions it.

## Testing

**Before adding or changing any test, read `@context/foundation/test-plan.md`** — the risk-first phased test rollout and quality contract (what's worth testing here, the cheapest layer per risk, and what's deliberately not tested).

**Don't hand-roll tests or pick the layer by feel — route to a skill.** Always start from a risk in `test-plan.md`, never from "cover this file"; the cheapest layer that gives a real signal wins. The trap behind every bad test — assert observable behavior, not the implementation under test — and the full anti-pattern lists are owned by the skills (`/10x-tdd`, `/10x-e2e`'s `references/`) and `test-plan.md`; don't restate them here.

- **New code, test-first** → **`/10x-tdd`** (when you can name the first failing test in one sentence and the impl isn't written yet).
- **Browser-level / multi-boundary risk** (auth + routing + API + DB, or UI-only behavior) → **`/10x-e2e`** (full workflow below).
- **Protecting existing code** → `/10x-research` → `/10x-plan` → `/10x-implement`, anchored on the risk.
- **A bug that slipped past the tests (test-driven debugging) — mandatory, not optional.** Reproduce it with a **failing test first**, then fix — never silently patch. Drive the red test with `/10x-tdd` (or `/10x-e2e` when the repro needs a browser). Assert the **persisted / observable state, not the API response** — a `200` can hide a failed write. The repro test stays as the regression guard for the path that had none.

Vitest 4 for unit specs under `src/__tests__/**/*.test.ts`. Playwright E2E under `e2e/**/*.spec.ts` (`pnpm test:e2e`) — requires the local Supabase stack (`supabase start`) up; the config auto-runs a **production build** (`pnpm build && pnpm start`, not `next dev` — avoids hydration races) and uses **system Chrome** (`channel: 'chrome'`, no bundled browser). Commands in `@package.json`.

**E2E authoring → use the `/10x-e2e` skill** for the full workflow (risk → seed → generate → review → verify) and its quality rules — locators, wait-for-state over `waitForTimeout`, test independence, DOM-vs-`--caps=vision`, the auto-heal boundary. Its `references/` carry the complete rules + prompt templates. An agent that can't load the skill should STOP per the rule at the top, not improvise its own E2E conventions.

**Mutation gate (Stryker) is ad hoc and vitest-only.** It drives the **vitest** runner, so behaviour covered only by Playwright E2E is invisible to it. Never run a bare `stryker run` over `src/**/*.ts` — most of the app would report `No coverage` (a misleading 0, not a quality signal). The `mutate` glob in `stryker.config.json` is deliberately scoped to unit-covered pure-logic modules; add new such modules there, narrow per-risk with `--mutate <file>`. How-to + triage rules → `@context/foundation/test-plan.md` §6.7.

**E2E always builds a fresh server, never reuses one** — `reuseExistingServer: false`, isolated port (3100) + build dir (`NEXT_DIST_DIR=.next-e2e`) so it can't hijack a running `next dev`. Don't set it `true` for speed. Why this is load-bearing → `@context/foundation/lessons.md`.

### Local data: two orthogonal lanes

- **E2E specs do NOT wipe or reset the DB** — there is no `globalSetup`/`db reset` in the test flow. Each spec self-seeds via real UI sign-up with a per-run `uniqueEmail` (`@e2e/helpers.ts`) and leaves its rows behind. They accumulate cruft, never wipe. If the local DB looks empty after testing, it's because **you** ran `supabase db reset` (e.g. to apply a new migration), not the specs.
- **Dev/manual data comes from `@supabase/seed.sql`** — wired via `[db.seed]` in `@supabase/config.toml`, so it runs after migrations on every `supabase db reset`. DEV-ONLY (Vercel never runs `db reset`). Two login-able accounts: **`dev@example.com` / `password123`** (minimal FSRS smoke bed) and **`test@gmail.com` / `test@Test`** (real-content dogfooding playground, regenerated from `/workspace/learning` notes by `@supabase/seed-scripts/generate-section-seed.mjs` — see its header).
- **`supabase db reset` is the canonical refresh** — clears E2E cruft AND rebuilds both accounts. Two traps: (1) it wipes **all** local data including any hand-made accounts — confirm first; (2) re-running `seed.sql` without a reset **double-inserts the `dev@example.com` `memory_cards`** (that block has no `on conflict` guard; the `test@gmail.com` block is id-keyed so it's idempotent). Refresh via `db reset`, not by re-applying the seed.

## Commits & CI

- Commit style (from `git log`): lowercase imperative subject, no Conventional-Commits prefix — e.g. `add supabase cli dev-dep + fix arm64 binary resolution`.
- CI gate is **Vercel's GitHub integration**, not GitHub Actions (no `.github/workflows/*`): push → preview deploy; merge to `main` → production. Remote: `github.com/ex-Plant/coding-learning-companion` (public).

## Tooling tripwires

- After every `10x get`, the two in-place `/10x-bootstrapper` patches are reverted by upstream — re-apply with `git checkout HEAD -- .claude/skills/10x-bootstrapper/`. The patches: (1) `audit_commands.js` is a pnpm/yarn/bun-keyed map, not the shipped `npm audit` string; (2) the temp scaffold dir is `bootstrap-scaffold` (no leading dot — `create-next-app` rejects dot-prefixed names). Full audit trail: `@context/changes/bootstrap-verification/verification.md`.
- shadcn was init'd `--preset nova` (`radix-nova`, `neutral`). `globals.css` was patched to drop a `--font-sans` circular reference (literal `"Geist"` names, required for Tailwind v4 `@theme inline`). Swap palettes by editing the `@theme inline` / `:root` / `.dark` OKLCH blocks in `src/app/globals.css`; token names stay. Visual tuning: tweakcn.com.
- `wykonczymy` (`/Users/konradantonik/workspace/yolo/wykonczymy`) is a reference repo for tooling/component patterns. **Ignore its Payload CMS layer** — this project uses Supabase. Full guidance: `@context/foundation/reference-repos.md`.

## Vercel

Vercel is the canonical surface for deploys, env, logs, domains, linking. Use vercel skills to talk with vercel and to get latest vercel api.

- **Account/link state:** CLI user `eggplantdev` (hobby), **personal** scope (not a team), repo-level link (`.vercel/repo.json`, not `project.json`), prod region `fra1` (EU, co-located with Supabase). Confirm: `vercel whoami` → expect `eggplantdev`. If it returns `Not authorized`, `.vercel/` is stale-linked — `rm -rf .vercel && vercel link --yes --project coding-learning-companion` (no `--scope`; personal accounts reject it).

## Linear (issue tracking)

- MCP connected at project scope (`.mcp.json`, OAuth done); tools are `mcp__linear__*` (load schemas via `ToolSearch` first). Backlog lives in team **`Ex-plant`** (key `EX`), project **`Coding Learning Companion`**. Other workspace projects are personal — leave them alone.
- **`roadmap.md` is the source of truth; Linear mirrors it.** Keep issue status in sync as you work a change: `save_issue` with an `id` (e.g. `EX-359`) updates in place — `state`, `assignee`, `priority`, `labels`, links; `save_comment` for notes.

## Claude Code workflow

> The user's path-scoped global rules in `~/.claude/rules/*` (typescript/react/styling conventions + general/general_persona/learning/english_refinement) are the **single source** — this file deliberately does not restate them.

### Per-change review gate

Close out **every change that has its own `context/changes/<id>/` folder** — a roadmap slice, a foundation, or any standalone change (a hardening pass, a refactor, a bugfix that earned a plan) — by running the **`slice-review-gate`** skill. Having a change folder _is_ the trigger; only trivial folder-less edits skip it. The skill carries the review checks, unit-of-work, full suite, and archive step as conditional defaults — it detects the 10x + pnpm + Supabase pattern this project is on — so none of that is restated here. This project matches the pattern, so the defaults apply as-is.

**Then post-archive sync — the change is NOT done until this lands:** update any doc the change made stale — `lessons.md` if a rule emerged; for a roadmap slice also `roadmap.md ## Done` (auto via `/10x-archive`) and flip its matching Linear issue to Done (ID map below). A standalone change with no roadmap/Linear entry skips those two — the archive is its record. Detail lives once, in the archive (+ `roadmap.md ## Done` for slices) — never as a per-change narrative in a rule file.

## Course & project state

- **Source of truth (v2 brownfield re-shape, 2026-06-03):** `@context/foundation/prd-v2.md` (11-section) + `@context/foundation/roadmap.md` (v2). v1 prd/roadmap archived → `context/foundation/archive/`. Model: a **Subject** groups notes; cards (`memory_cards`, `note_id`-linked) are the recall unit; the **card→note path** is the differentiator.
- **Per-slice build log:** every shipped slice has a one-line record in `@context/foundation/roadmap.md` `## Done` (outcome + commits + lesson) + a full immutable record at `context/archive/<date>-<change-id>/`.
- **Lessons:** `@context/foundation/lessons.md` is the recurring-rules register — append rules there, never inline them in a rule file.
- **Linear ID map** (roadmap is source of truth; Linear mirrors it — flip the matching issue to Done at archive): F-01 EX-359 · F-02 EX-360 · S-01 EX-361 · S-02 EX-362 · S-03 EX-363 · S-04 EX-364 · S-05 EX-365 · S-06 EX-368 · S-07 EX-370 · S-08 EX-369 · S-09 EX-371 · S-13 EX-375 · S-17 (topic-checks-listing) EX-385.
- **Course (10xDevs 3.0):** live structure via `10x list`; this project has M1 + M2 done (m2l1–m2l4, F-01/F-02 shipped), M3+ not yet fetched. The `@przeprogramowani/10x-cli` sentinel at the bottom of `CLAUDE.md` is the fetched lesson bundle — never hand-edit inside its markers. Per-lesson milestones live in commit history + `roadmap.md`.
