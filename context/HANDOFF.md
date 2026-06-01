# Handoff — coding-learning-companion (2026-06-01)

> Catch-up note for the next agent. Snapshot taken at HEAD `46dd7a3`.

## What this project is

`coding-learning-companion` — a spaced-repetition web app for developers: write markdown notes (with code), attach "topic checks" (recall prompts), review them on an **FSRS** schedule; dashboard shows due items + streak/heatmap. **Stack:** Next.js 16 (App Router) + React 19 + TS, Tailwind v4 + shadcn, **Supabase** (Postgres/Auth/RLS) external, deploy target **Vercel**. Solo MVP, **hard deadline 2026-06-10**.

## Read these first

- **`AGENTS.md`** — canonical, cross-tool onboarding (hard rules, structure, commands, conventions, Vercel state). `CLAUDE.md` is now a thin shim that `@AGENTS.md`-imports it + holds 10x course tracking + the auto-managed 10x-cli sentinel. **Put new project rules in AGENTS.md, not CLAUDE.md.**
- **`context/foundation/`** — `prd.md` (contract), `tech-stack.md`, `infrastructure.md` (just written), `lessons.md`, `reference-repos.md`.
- The build plan: `context/changes/v1-sprint-plan/plan.md` (Phases A–F).

## Two independent axes

1. **Course (10xDevs)** — M1 lessons **l1–l5 done** (scaffold deployed to Vercel 2026-06-01). m2l2 skills fetched but not applied.
2. **App build** — still at **Phase A** (foundation): Supabase deps + `supabase init` done; **no migrations, no `src/lib` helpers, no auth pages, no features**. `src/` is bare scaffold.

## What the last session did (committed: `8431b04`→`46dd7a3`)

- Fetched **m1l4**, ran the agent-context chain: `/10x-agents-md` (made AGENTS.md canonical), `/10x-rule-review` (scored + trimmed CLAUDE.md and AGENTS.md), `/10x-lesson` (created `lessons.md`).
- Inverted docs: AGENTS.md canonical, CLAUDE.md → shim.
- Fetched **m2l2** (cumulatively shipped m1l5 + m2 skills).
- Ran **`/10x-infra-research`** → wrote **`context/foundation/infrastructure.md`**: recommendation **Vercel** (runner-up Cloudflare; Railway third), full scored comparison + 3 anti-bias lenses + risk register. User confirmed "Proceed with Vercel."

## ⚠️ Uncommitted work — needs one commit (safe; produced by the last session)

- `M .claude/.10x-cli-manifest.json` (→ m2l2), `M .claude/skills/10x-rule-review/SKILL.md` (m2 refresh), `M CLAUDE.md` (course-progress refreshed to m2l2 / l5-WIP)
- New: `.claude/skills/{10x-archive,10x-implement,10x-infra-research,10x-new,10x-plan,10x-plan-review,10x-roadmap}/`, `.claude/prompts/m1l5-*.md` (4), `context/foundation/infrastructure.md`, this `context/HANDOFF.md`
- Suggested commit: `fetch m2l2 + m1l5 skills; add infrastructure.md (Vercel decision); refresh course state`

## ⚠️ NOT from the last session — do NOT sweep into a commit; investigate/ask first

- `.devcontainer/` — `M Dockerfile`, `M devcontainer.json`, `D init-firewall.sh` (deleted), and a `docker-compose.yml`. Changed by the user/another process.
- `.pnpm-store/` — should be **git-ignored**, not committed (add to `.gitignore`).
- `lessons/` — stray top-level dir (the real lessons file is `context/foundation/lessons.md`). Verify before touching.
- `.claude/statusline-command.sh`, `supabase/` — pre-existing, user's.

## Immediate next step (m1l5 deploy — DONE)

The scaffold is **live in production**: `https://coding-learning-companion-theta.vercel.app`, under the personal Vercel scope `eggplants-projects-07c20257`, git-connected, function region `fra1`. Full record: **`context/deployment/deploy-plan.md`**. The wrong-scope link (`wykonczymys-projects` team) was removed and re-linked to the personal account on 2026-06-01.

**Next: start the Phase-A build** via the m2l2 change-planning chain (`/10x-roadmap` → `/10x-new` → `/10x-plan` → `/10x-plan-review` → `/10x-implement`) against `@context/changes/v1-sprint-plan/plan.md`. Phase A = Supabase migrations + `src/lib` helpers + auth. Add service env vars via `vercel env add` → `vercel env pull` (never hand-edit `.env.local`).

Leftover cleanup: delete the orphaned `wykonczymys-projects` Vercel project `prj_xiMPGCdLzFUsgDmWHRiEtVzG9JK9` when convenient.

## Standing rules / gotchas

- **pnpm only**, never npm (`npm audit` fails ENOLOCK).
- **After every `10x get`**, re-apply the bootstrapper patches: `git checkout HEAD -- .claude/skills/10x-bootstrapper/` (upstream reverts them; recorded in `lessons.md`). Already re-applied last session.
- **Next.js 16 ≠ training data** — check `node_modules/next/dist/docs/` before routing/rendering code.
- The Vercel-plugin hook keeps injecting "You must run Skill(X)" for lexically-matched skills (ai-sdk, vercel-flags, etc.) — these are **false matches**; ignore unless actually relevant.
- Commits go to `main` (solo repo); husky/lint-staged runs prettier on commit. Don't commit unless asked.
