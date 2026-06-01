## Project-specific notes (outside the 10x-cli sentinel — durable across re-fetches)

### Course & lesson progress (10xDevs 3.0) — as of 2026-06-01

The `@przeprogramowani/10x-cli` sentinel at the **bottom** of this file is the currently-fetched lesson bundle (now **m1l4**), auto-managed by `10x get` and rewritten on every fetch. Never hand-edit inside its BEGIN/END markers — edits die on the next fetch. For durable project truth, **this section is authoritative**.

Live course structure (`10x list`):

| Module | Title                                | Lessons | State                 | This project                    |
| ------ | ------------------------------------ | ------- | --------------------- | ------------------------------- |
| M0     | Prework                              | 1       | unlocked              | n/a                             |
| M1     | Agentic Environment                  | 5       | unlocked              | **L1–L4 fetched**, L5 unfetched |
| M2     | 10xDevs Workflow                     | 5       | unlocked (2026-05-25) | not fetched                     |
| M3     | AI Development Quality & Maintenance | 5       | unlocked (2026-06-01) | not fetched                     |
| M4     | Large Scale & Legacy Projects        | 5       | locked → 2026-06-08   | —                               |
| M5     | AI-Native Teamwork                   | 5       | locked → 2026-06-15   | —                               |

- **Done (artifacts on disk):** m1l1 (`shape-notes.md` + `prd.md`), m1l2 (`tech-stack.md`), m1l3 (scaffold + `context/changes/bootstrap-verification/verification.md`).
- **m1l4 skills installed (2026-06-01):** `/10x-agents-md`, `/10x-rule-review`, `/10x-lesson` (+ `skill-explainer` prompt). Fetched, not yet run — see the two open items below.
- **Next chain link:** m1l5 "From Localhost to Production" (`/10x-infra-research` → `context/foundation/infrastructure.md` → Plan-Mode deploy → `context/deployment/deploy-plan.md`).
- **Open m1l4 item — `context/foundation/lessons.md` still does not exist.** It is the `/10x-lesson` artifact; the skill self-bootstraps the file on first invocation. The sentinel below lists it as a foundation path — a forward-pointer, not a missing file to hunt for.
- **Open m1l4 item — `AGENTS.md` and this `CLAUDE.md` were hand-written, not produced by the m1l4 skills.** Run `/10x-rule-review` on both (5-axis scorecard; length verdict OK ≤200 non-empty lines, WARN 201–500, FAIL 501+; this file is ~149 non-empty = OK on length, so any findings will be precision/redundancy/ordering, not size).

**`10x get` notes:** re-fetching any lesson reverts the two in-place bootstrapper patches documented below — re-apply with `git checkout HEAD -- .claude/skills/10x-bootstrapper/` (done after the m1l4 fetch, 2026-06-01). CLI was 1.6.1 at last fetch; latest 1.7.0 (`pnpm add -g @przeprogramowani/10x-cli`; not npm).

**Build progress is a separate axis** from course progress. The app build follows the hand-rolled `context/changes/v1-sprint-plan/` (deadline 2026-06-10) and is currently at **Phase A only**: `@supabase/ssr` + `@supabase/supabase-js` installed and `supabase init` run (`supabase/config.toml`), but no migrations, no `src/lib` Supabase helpers, no auth pages. Phases B–F untouched. See `plan.md` for the phase breakdown and cut order.

### Package manager: pnpm

This project uses **pnpm**, not npm. The `context/foundation/tech-stack.md` hand-off carried `package_manager: npm` but it was overridden to `pnpm` at bootstrap time and the lockfile is `pnpm-lock.yaml`. When in doubt:

- Run scripts with `pnpm <script>` (`pnpm dev`, `pnpm build`, `pnpm lint`).
- Add deps with `pnpm add <pkg>` / `pnpm add -D <pkg>`.
- Audit with `pnpm audit --json` — **not** `npm audit`, which fails with `ENOLOCK` because there is no `package-lock.json`.
- If you ever need to override a transitive dep, use `pnpm.overrides` in `package.json`, not `npm overrides`.
- **`pnpm.supportedArchitectures` is set** (`os: [darwin, linux]`, `cpu: [arm64, x64]`). Without it, pnpm pulled the wrong-arch Supabase CLI binary (`@supabase/cli-darwin-x64` on an arm64 Mac), causing `No matching Supabase CLI binary binary found for darwin-arm64` at runtime. The config forces pnpm to fetch both arch binaries so the native one resolves locally and CI/x64 stays covered. Keep it when adding other CLIs that ship platform-specific binaries.

### Bootstrap fixes applied to the `/10x-bootstrapper` skill

The first bootstrap run on this project surfaced two gaps in the shipped skill. Both were patched in-place under `.claude/skills/10x-bootstrapper/`; the patches survive in this repo but will be **lost on the next `10x get m1l3`** unless re-applied. If you re-fetch the lesson, re-apply these:

1. **`bootstrapper-config.yaml` → `audit_commands.js` is a map, not a string.** The shipped skill hardcoded `js: "npm audit --json"`, which is wrong on pnpm/yarn/bun projects. The patched version routes by resolved package manager — a `js:` map keyed by `npm` / `pnpm` / `yarn` / `bun` with an `_default`. Read the live value at `@.claude/skills/10x-bootstrapper/references/bootstrapper-config.yaml` (kept there, not pasted here, so this note can't drift from it). Companion edits live in `references/post-scaffold-verification.md` (per-ecosystem invocation block) and `SKILL.md` (Step 1 lookup paragraph).

2. **Temp scaffold dir name has no leading dot.** The shipped skill substituted `{name}=.bootstrap-scaffold` for the `subdir-then-move` and `git-clone` strategies. `create-next-app` rejects names starting with `.` ("name cannot start with a period" — npm naming restriction), so the patched version uses `bootstrap-scaffold` (no leading dot). Search-and-replace across `SKILL.md`, `references/scaffold-merge.md`, `references/handoff-consumer.md`, `references/refusal-protocol.md`, `references/bootstrapper-config.yaml`, `references/verification-log-schema.md`.

The audit trail of the first run lives in `context/changes/bootstrap-verification/verification.md` — the **Skill gaps observed during this run** subsection documents both fixes verbatim.

### Reference repositories

The user has other projects this one may draw patterns from. **Inspiration, not canon** — weigh against this project's own PRD/tech-stack each time. See `context/foundation/reference-repos.md` for the full breakdown of what to inherit vs ignore.

Quick pointer:

- **`wykonczymy`** at `/Users/konradantonik/workspace/yolo/wykonczymy` — production Next.js 16 + React 19 app. Permission scope already granted in `.claude/settings.local.json`. Use for tooling conventions (mise, husky, lint-staged, prettier, vitest, ESLint), component composition patterns, Zustand/TanStack patterns. **Ignore** its Payload CMS layer — this project uses Supabase per `context/foundation/tech-stack.md`.

### Tooling conventions (mirrored from `wykonczymy`)

Scripts and tool versions live in `@package.json` — don't restate them here (it drifts). Non-obvious bits only:

- **Node**: pinned to 24 via `mise.toml` — run `mise install` once after cloning.
- **Test specs**: live under `src/__tests__/**/*.test.ts` (Vitest).
- **Pre-commit**: husky runs `lint-staged` on changed files (eslint --fix + prettier --write for JS/TS, prettier for JSON/CSS/MD).
- **Formatter detail**: Prettier runs `prettier-plugin-tailwindcss` (Tailwind class sorting); config in `.prettierrc`.

### shadcn

Initialized with `--preset nova` (CLI default, `radix-nova` style, `neutral` base). Config in `components.json`. After init, `globals.css` was patched to fix the `--font-sans: var(--font-sans)` circular reference (literal `"Geist"` font family names instead — required for Tailwind v4 `@theme inline`, see `vercel-plugin:shadcn` skill).

Add components with `pnpm dlx shadcn@latest add <component>`. To swap the color palette later, replace the `@theme inline` and `:root` / `.dark` blocks in `src/app/globals.css` — token names stay (`--primary`, `--background`, etc.), only OKLCH values change. Use [tweakcn.com](https://tweakcn.com) for visual tuning.

### Deployment + env management (Vercel CLI)

> **DEFERRED (2026-05-26).** Vercel is not needed for local development and has been pushed to deploy time (sprint-plan Phase F). The provisional team-scope linkage and the Vercel-account cleanup are both parked until then. The rest of this section describes the intended workflow for when Vercel comes back into the picture — it is the plan, not the current state. **For local dev right now, env vars live directly in a git-ignored `.env.local`; the "no manual env editing" rule below only applies once env management migrates to `vercel env`.**

User has a Vercel account. **The Vercel CLI is the canonical surface for everything Vercel-touching on this project** — deploys, environment variables, logs, domains, project linking. Heavy use is expected and intentional.

**Hard rule: no manual editing of `.env.local`.** All env vars flow through Vercel: `vercel link` → `vercel env add <NAME>` (per var) → `vercel env pull .env.local`. Same three-step ritual for every new service (Supabase, Resend, …). Never `echo "FOO=bar" >> .env.local` — it's silently overwritten on the next pull and won't propagate to preview/prod.

**Deploys:** `vercel` = preview (also auto-fires on `git push` once GitHub integration is live); `vercel --prod` = production; `vercel logs <url>` / `vercel ls` for runtime logs + deploy list.

**Project config:** prefer `vercel.ts` (typed) over `vercel.json`. Full/current CLI syntax: `vercel-plugin:vercel-cli` skill — the API has shifted, don't trust training data.

**GitHub integration is part of the deploy story** — Vercel's GitHub integration is the v1 CI gate (per `tech-stack.md`; no `.github/workflows/*` ships in v1). The chain is: push to a GitHub repo → Vercel receives the webhook → Vercel builds + deploys (preview per branch / push, production on `main`). This means **the GitHub repo is a prerequisite, not a "later" concern**. First-time setup ritual on this repo:

1. `gh repo create <name> --source=. --private --push` (gh CLI is already authed as `ex-Plant`).
2. `vercel link` — picks the GitHub repo and creates a Vercel project linked to it.
3. `vercel env add <NAME>` for each env var, then `vercel env pull .env.local`.
4. First `git push` triggers a preview deploy. Merge to `main` triggers production.

**Vercel account in use for this project:**

- **CLI logged-in user:** `admin-63074310` (personal scope).
- **Available scopes from this login:** the personal scope (`admin-63074310`) plus one team — `wykonczymys-projects`, which also hosts the unrelated `wykonczymy` reference repo.
- **Current project linkage (provisional):** the project is currently linked to the `wykonczymys-projects` team (orgId `team_BWfyTqJnjIqZBkHwBL0elgS4`, projectId `prj_xiMPGCdLzFUsgDmWHRiEtVzG9JK9`). This was an accident at the `vercel link` scope prompt where the team was the default. **The user has flagged Vercel-account hygiene as a separate cleanup task and may move this project to a different scope (personal or a different account entirely) later.** Until that cleanup happens, work continues against the current `wykonczymys-projects` linkage.
- **Implications of the current linkage:** billing and team-member access for `coding-learning-companion` are currently shared with `wykonczymy` under the same Vercel team. Env vars added via `vercel env add` land in the team-scoped project, not the user's personal Vercel.
- **Confirm CLI state anytime** with `vercel whoami` (should print `admin-63074310`) and `cat .vercel/project.json` (orgId tells you which scope the link is in: `team_*` = team, anything else = personal). If `vercel whoami` prints something else, run `vercel logout` + `vercel login` before any Vercel-touching work.

**Status of this repo (as of last update):** GitHub remote is `https://github.com/ex-Plant/coding-learning-companion` (public). Vercel-linked to the `wykonczymys-projects` team scope as described above; `.vercel/project.json` is committable but git-ignored by Vercel CLI convention. Vercel CLI installed locally is currently 54.1.0; latest is 54.4.x. Run `pnpm add -g vercel@latest` to update.

**Open follow-up:** user to clean up their Vercel accounts (consolidate or separate), then decide whether to keep the current linkage, move to personal scope on this account, or re-link to a different account entirely. Pending that decision, the current linkage is a known-imperfect baseline, not a final state.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit — Module 1, Lesson 4

Onboard the agent to the project you scaffolded in Lesson 3 with the **agent-context chain**:

```
(/10x-init  →  /10x-shape  →  /10x-prd  →  /10x-tech-stack-selector  →  /10x-bootstrapper)  →  /10x-agents-md  →  /10x-rule-review  →  /10x-lesson
```

The PRD → tech-stack → bootstrap chain ships from Lessons 1–3 (re-included so you can fix the project mid-flight). `/10x-agents-md`, `/10x-rule-review`, and `/10x-lesson` are the lesson's main topics. The chain extends in Lesson 5 to the infra/deploy step.

### Task Router — Where to start

| Skill                                                                                                                                  | Use it when                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agent context (lesson focus)**                                                                                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/10x-agents-md`                                                                                                                       | The repo is scaffolded but the agent has no project-specific onboarding. Inspects the repo (package manifest, README, scripts, lint/test config, layout, commit history) and writes a concise, ordered "Repository Guidelines" to `AGENTS.md` (or, when invoked from a subdirectory, a directory-level `AGENTS.md` reframed around local conventions and the dominant unit). Use as an alternative to the host's built-in `/init` or as a fallback for tools without one. Repo-level body targets ~200 lines; directory-level guides target 120–250 words. |
| `/10x-rule-review <path>`                                                                                                              | You have a rules-for-AI file (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*.mdc`, `.github/copilot-instructions.md`, `.windsurfrules`, nested per-area files) and want a 5-axis scorecard: length, embedded code/config snippets, precision of language, redundancy with public knowledge, and rule ordering. Tool-agnostic — scores the artifact's condition, not the project. Default output is read-only; only Check 5 (reorder) may edit, and only with explicit approval.                                                                                |
| `/10x-lesson [seed]`                                                                                                                   | You spotted a recurring rule worth surfacing for future runs of `/10x-frame`, `/10x-research`, `/10x-plan`, `/10x-plan-review`, `/10x-implement`, and `/10x-impl-review`. Appends a single entry (Context / Problem / Rule / Applies to) to `context/foundation/lessons.md`. Self-bootstraps the file with the canonical `# Lessons Learned` header on first use. Append-only — never reorders or rewrites prior entries.                                                                                                                                  |
| **Re-run upstream if needed**                                                                                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/10x-init` / `/10x-shape` / `/10x-prd` / `/10x-tech-stack-selector` / `/10x-bootstrapper` / `/10x-stack-assess` / `/10x-health-check` | Bundled so you can fix the PRD, swap the stack, or re-scaffold mid-flight. If `/10x-rule-review` flags a `FAIL` you can't shrink your way out of, that often points back to ambiguous PRD or stack decisions — re-run the upstream skill rather than padding `AGENTS.md` with corrections.                                                                                                                                                                                                                                                                 |

### How the chain hands off

- `/10x-agents-md` writes (or surgically updates) `AGENTS.md` at the resolved scope. Repo-level scope = the file lives at the repo root and frames the project as a whole; directory-level scope = the file lives next to the code it governs and reframes around the local unit, dropping repo-wide framing entirely. The skill never silently overwrites — it switches to an update flow when the target exists.
- `/10x-rule-review` reads any rules-for-AI markdown file you point it at and prints a 5-check scorecard (`OK` / `WARN` / `FAIL`) with concrete fixes. It does not depend on `/10x-agents-md` having run; you can review `.cursor/rules/`, copilot instructions, or a hand-written `CLAUDE.md` the same way.
- `/10x-lesson` self-bootstraps `context/foundation/lessons.md` on first use, then appends one Context/Problem/Rule/Applies-to entry per invocation. The file is consumed as a prior by the planning- and review-phase skills introduced later in the workflow — `/10x-frame`, `/10x-research`, `/10x-plan`, `/10x-plan-review`, `/10x-implement`, `/10x-impl-review`.

### What the lesson's skills capture (and what they do NOT)

- **`/10x-agents-md` captures**: project structure, build/test/lint commands actually present in scripts, commit conventions inferred from history, repo-specific tripwires the agent would otherwise miss, references to canonical files via `@`-paths instead of pasting their content. Directory-level scope additionally captures: local naming/layout patterns inferred from siblings, allowed/forbidden imports, the test pattern used by neighbours, and tripwires visible in the immediate area.
- **`/10x-agents-md` does NOT** paste in the contents of `tsconfig.json` / `eslint.config` / framework docs the agent already knows; it does NOT generate generic "write clean code" intentions; it does NOT replace the host's built-in `/init` when one exists — it's positioned as an alternative or fallback, not a default.
- **`/10x-rule-review` captures**: a length verdict (OK ≤ 200 non-empty lines, WARN 201–500, FAIL 501+), code/config blocks that should be `@`-references instead, vague-intention language, redundancy with framework docs the agent already has from training, and a Check 5 reorder proposal that surfaces critical rules to the top.
- **`/10x-rule-review` does NOT** edit the file by default; it does NOT score project content (architecture, stack choices) — it scores the rule artifact's condition; it does NOT generate a "fixed version" of the file (Check 5 may move sections with explicit approval, never rewrite rule wording).
- **`/10x-lesson` captures**: one entry per invocation with a short imperative H2 title (the title IS the rule), Context (subsystem / phase / file pattern, specific enough to pattern-match), Problem (what concretely breaks without the rule, ideally with a past incident), Rule (1–2 imperative sentences pasteable verbatim into a future review finding), Applies to (subset of `frame`, `research`, `plan`, `plan-review`, `implement`, `impl-review`, or `all`).
- **`/10x-lesson` does NOT** edit or remove existing lessons — the file is append-only by design (rewriting recurring rules without thought is the failure mode this convention prevents); it does NOT batch multiple rules per invocation; it does NOT pre-fill fields proactively (the user does the writing — that's the price of capturing rules outside a structured review).

### The inclusion test (the filter for AGENTS.md / CLAUDE.md)

Before you add a rule to any rules-for-AI file, ask: _could the agent know this without this file? Could public training data — books, blogs, repos in this stack — have prepared it for this?_ If yes, drop it. If no, keep it. The file is onboarding for an agent that already knows TypeScript / Python / your framework but does NOT know your local conventions.

Belongs:

- non-obvious project conventions (error-response shape, file naming, allowed import paths)
- project-specific traps and "embarrassing" workarounds tied to history or dependency bugs
- referenced canonical files via `@`-paths (e.g. `@src/features/users/user.service.ts` as a pattern reference, not pasted code)

Does NOT belong:

- mainstream framework documentation
- README content the agent will read anyway (link with `@README.md`)
- popular generic advice ("use TypeScript strict mode") that's already enforced by config
- intention statements ("write clean code", "follow good practices") — convert to a checkable behaviour or drop

### U-shaped attention and granular rules

LLMs attend most strongly to the start and end of context (Lost-in-the-Middle / U-shaped attention). A long monolithic `CLAUDE.md` puts its middle rules in the weakest attention zone. Two practical consequences:

1. **Most important rules go to the top** of any rule file.
2. **Per-area rules belong next to their code** — nested `AGENTS.md` / `CLAUDE.md` inside `src/api/`, `.cursor/rules/*.mdc` with file globs, etc. Granular files are loaded selectively and arrive whole near the start of their own section, instead of being buried at line 400 of one big file.

`/10x-rule-review` Check 5 (reorder) operationalizes consequence (1); the inclusion test plus directory-level `/10x-agents-md` operationalizes consequence (2).

### The five-pattern calibration drill

Before writing a rule, validate that the agent actually breaks the convention without it. Pick one pattern from your project (error-response shape, file naming, import style, module structure, date handling). Then:

1. Ask the agent to implement against the pattern 3–5 times from a clean state, no rule.
2. Note where it broke the convention; capture run time, files explored, and visible cost/tokens if the host surfaces them.
3. Add a 1–3-sentence rule to the appropriate scope (root or area-level).
4. Re-run the same task in a fresh session and compare convention adherence, time, files, and iterations.

If the agent already trends toward the convention without the rule, you don't need the rule. If it systematically picks the wrong pattern, you've found a high-leverage rule to add. This drill is what "earning a rule from a recurring failure" actually looks like.

### Hierarchy and tool interop

- **Claude Code** loads `CLAUDE.md` from the user dir (`~/.claude/CLAUDE.md`), the repo root, and any subdirectory the agent works under. Deeper files override or supplement higher ones.
- **Codex** and **GitHub Copilot** load `AGENTS.md` from the current directory upward — closest file wins.
- One canonical file is preferable to three duplicates. A common pattern: `AGENTS.md` as source of truth, `CLAUDE.md` as a thin Claude-Code shim with `@AGENTS.md` import, `.github/copilot-instructions.md` only if Copilot needs its own additions. Symlink (`ln -s AGENTS.md CLAUDE.md`) is the simplest deduplication when tools require both names.
- Auto-memory (e.g. Claude Code's `~/.claude/projects/<dir-with-slashes-as-dashes>/memory/MEMORY.md`) is local to the machine and not a substitute for `AGENTS.md`. Team-binding rules live in the repo; auto-memory is a personal cache, periodically reviewable.

### Inner-loop hooks (deterministic feedback without prompting)

Mechanical, non-pickable checks belong in hooks (e.g. Claude Code's `PostToolUse`), not in the rule file. The agent finishes an edit; a formatter or fast lint runs; the result feeds back without you reminding it. Settings template (`settings.json.template`) ships in the lesson pack as the wiring entry point. Keep procedural workflows (deeper review, release checklist, deploy on sandbox) in skills, and reserve hooks for deterministic tool signals.

### Foundation paths used by this lesson

- `AGENTS.md` / `CLAUDE.md` (and per-area variants) — `/10x-agents-md` output
- `context/foundation/lessons.md` — `/10x-lesson` output (append-only register, consumed by future planning/review skills)
- `context/foundation/prd.md`, `context/foundation/tech-stack.md` — inputs from earlier lessons, still present
- `docs/reference/contract-surfaces.md` — load-bearing names registry (scaffolded by `/10x-init`)

### Universal language

The shipped skills carry no 10xDevs / cohort / certification references. `/10x-agents-md` discovers from the repo it's invoked in; `/10x-rule-review` is tool-agnostic and treats every file as "a rules-for-AI artifact"; `/10x-lesson` writes one entry shape regardless of project domain. The 5-pattern calibration drill is illustrative — substitute patterns from your own stack.

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
