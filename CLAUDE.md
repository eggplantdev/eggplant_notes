<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit — Module 1, Lesson 3

Scaffold the project for the stack you picked in Lesson 2, with the **bootstrap chain**:

```
(/10x-init  →  /10x-shape  →  /10x-prd)  →  /10x-tech-stack-selector  →  /10x-bootstrapper
```

The PRD chain ships from Lesson 1 and the tech-stack-selector ships from Lesson 2 — both re-included in this lesson so you can fix the PRD or swap the stack mid-flight. `/10x-bootstrapper` is the lesson's main topic. The chain ends here in v1; a future Lesson 4 will set up agent context (`CLAUDE.md`, `AGENTS.md`).

### Task Router — Where to start

| Skill                                                                | Use it when                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bootstrap (lesson focus)**                                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/10x-bootstrapper`                                                  | You have a hand-off at `context/foundation/tech-stack.md` (written by `/10x-tech-stack-selector`) and you are ready to scaffold the project into the current directory. The skill reads the hand-off, looks up the chosen card in the starter registry, runs its CLI through one of three cwd strategies (scaffold into a temp directory then move files up; scaffold directly into the current directory; clone a starter repo without keeping its git history), preserves `context/` always, sidelines other clashes as `.scaffold` siblings, runs a light pre-scaffold recency check and a deeper post-scaffold audit, and writes a verification log to `context/changes/bootstrap-verification/verification.md`. Use AFTER `/10x-tech-stack-selector`. |
| **Re-run upstream if needed**                                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/10x-init` / `/10x-shape` / `/10x-prd` / `/10x-tech-stack-selector` | Bundled so you can fix the PRD or swap the stack mid-flight. If `/10x-bootstrapper` surfaces a registry-drift refusal or you change your mind on the starter, re-run `/10x-tech-stack-selector` to regenerate `tech-stack.md` and re-invoke.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

### How the chain hands off

- `/10x-tech-stack-selector` (Lesson 2) writes `context/foundation/tech-stack.md` with a 4-key frontmatter (`starter_id`, `package_manager`, `project_name`, `hints`) plus a one-paragraph `## Why this stack` body.
- `/10x-bootstrapper` reads that file FULLY (no fallback to conversation history). If it is absent, the skill refuses with a one-sentence redirect to `/10x-tech-stack-selector` and stops — no inline mini-handoff, no standalone-mode in v1.
- The chosen `starter_id` is looked up in `/skills/10x-tech-stack-selector/references/starter-registry.yaml`. The skill consumes that registry; it does not own it. A CI validator (`scripts/validate-starter-registry-sync.mjs`) prevents bootstrapper from referencing a `starter_id` absent from the registry.
- The skill writes `context/changes/bootstrap-verification/verification.md` as the audit-trail log for the run. Schema in `/skills/10x-bootstrapper/references/verification-log-schema.md`.

### What bootstrapper captures (and what it does NOT)

- **Captured (v1)**: scaffold via the chosen card's `cmd_template` (CLI delegation, not inline file generation), three cwd strategies dispatched from `bootstrapper-config.yaml` (`subdir-then-move`, `native-cwd`, `git-clone`), strict conflict policy producing `.scaffold` siblings + always preserving `context/`, two verification slots (light pre-scaffold recency check + deep post-scaffold language-aware audit), severity-tiered audit summary, full verification log on disk.
- **NOT captured in v1 (deliberate)**: `AGENTS.md` / `CLAUDE.md` generation (deferred to a future Lesson 4 — "Memory Architecture"); per-starter cert-element placement overlays (live with the future agent-context skill, not here); CI workflow files; AI-as-bridge fallback for stacks outside the registry (deferred to v2 — in v1 chain-mode tech-stack-selector already gates on the registry, so the case cannot arise); standalone-mode where the user names a stack inline without a hand-off (deferred to v2); compensation actions for `bootstrapper_confidence: best-effort` or `quality_override: true` (surfaced in conversation but no automated follow-up — that, too, is the future memory-architecture skill's job).

### The conflict policy

When the skill moves files from a temp scaffold directory up into your current working directory, it applies a strict matrix:

- **`context/**`** — anything the scaffold tried to write under `context/`is **dropped**. Your`context/` is the source of truth for the bootstrap chain (PRD, tech-stack hand-off, plans, frames) and is never overwritten.
- **`.gitignore`** — append-merged: your existing lines stay in order, then the scaffold's lines are de-duped against your set and appended with a separator comment. Git's ignore semantics are additive, so combining is safe.
- **`package.json`, `README.md`, `CLAUDE.md`, `AGENTS.md`, root-level `*.md`** — your existing file wins; the scaffold's copy lands as `<filename>.scaffold` sibling. You can `diff README.md README.md.scaffold` to see what the starter shipped vs what you had.
- **Anything else** — moves silently if no conflict, sidelined as `<filename>.scaffold` if there is one. The matrix never deletes user files.

For the `git-clone` strategy (10x-astro-starter and similar): the cloned `.git/` is deleted before move-up, so the upstream starter's history does not leak into your repo. You initialise your own history afterwards (`git init`).

### Verification log

Every run writes `context/changes/bootstrap-verification/verification.md`. Sections:

- **`## Hand-off`** — verbatim copy of the tech-stack.md frontmatter and `## Why this stack` body.
- **`## Pre-scaffold verification`** — recency findings table (npm package version + `time.modified` for JS starters; GitHub `pushed_at` for any starter with a GitHub `docs_url`).
- **`## Scaffold log`** — the resolved CLI invocation, exit code, files moved, conflicts surfaced as `.scaffold` siblings, `.gitignore` handling.
- **`## Post-scaffold audit`** — full per-language audit output (`npm audit --json` for JS, `pip-audit` for Python, `cargo audit` for Rust, etc.). Severity-tiered: CRITICAL and HIGH surfaced inline in chat, MODERATE and LOW log-only. Direct-vs-transitive split where the tool supports it.
- **`## Hints recorded but not acted on`** — every hint from the hand-off bootstrapper read but did not act on in v1. Audit-trail completeness for the future memory-architecture skill.
- **`## Next steps`** — pointer text. v1 names "your project is scaffolded and verified — happy hacking" and flags the future Lesson 4 skill as the next chain link.

The folder (`context/changes/bootstrap-verification/`) deliberately has no `change.md`. Bootstrap runs are one-shot artifacts, not tracked workflow changes — the folder hosts the log and nothing else. Re-runs apply a warn-and-confirm guard before overwriting; the escape hatch is `verification-v2.md` (and so on).

### Foundation paths used by this lesson

- `context/foundation/tech-stack.md` — input (from Lesson 2)
- `context/changes/bootstrap-verification/verification.md` — output (the audit-trail log)
- `context/foundation/lessons.md` — recurring rules & pitfalls
- `docs/reference/contract-surfaces.md` — load-bearing names registry

### Universal language

The shipped skill carries no 10xDevs / cohort / certification references. The post-scaffold audit dispatches by `language_family` against a small lookup table; cohorts whose stack lands in `java`, `php`, `dart`, or a multi-language combination see a "no built-in audit tool for this ecosystem" log line and a recommended external tool, not a fake "0 findings" record.

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->

## Project-specific notes (outside the 10x-cli sentinel — durable across re-fetches)

### Package manager: pnpm

This project uses **pnpm**, not npm. The `context/foundation/tech-stack.md` hand-off carried `package_manager: npm` but it was overridden to `pnpm` at bootstrap time and the lockfile is `pnpm-lock.yaml`. When in doubt:

- Run scripts with `pnpm <script>` (`pnpm dev`, `pnpm build`, `pnpm lint`).
- Add deps with `pnpm add <pkg>` / `pnpm add -D <pkg>`.
- Audit with `pnpm audit --json` — **not** `npm audit`, which fails with `ENOLOCK` because there is no `package-lock.json`.
- If you ever need to override a transitive dep, use `pnpm.overrides` in `package.json`, not `npm overrides`.
- **`pnpm.supportedArchitectures` is set** (`os: [darwin, linux]`, `cpu: [arm64, x64]`). Without it, pnpm pulled the wrong-arch Supabase CLI binary (`@supabase/cli-darwin-x64` on an arm64 Mac), causing `No matching Supabase CLI binary binary found for darwin-arm64` at runtime. The config forces pnpm to fetch both arch binaries so the native one resolves locally and CI/x64 stays covered. Keep it when adding other CLIs that ship platform-specific binaries.

### Bootstrap fixes applied to the `/10x-bootstrapper` skill

The first bootstrap run on this project surfaced two gaps in the shipped skill. Both were patched in-place under `.claude/skills/10x-bootstrapper/`; the patches survive in this repo but will be **lost on the next `10x get m1l3`** unless re-applied. If you re-fetch the lesson, re-apply these:

1. **`bootstrapper-config.yaml` → `audit_commands.js` is a map, not a string.** The shipped skill hardcoded `js: "npm audit --json"`, which is wrong on pnpm/yarn/bun projects. The patched version routes by resolved package manager:

   ```yaml
   audit_commands:
     js:
       npm: 'npm audit --json'
       pnpm: 'pnpm audit --json'
       yarn: 'yarn npm audit --json'
       bun: 'bun audit --json'
       _default: 'npm audit --json'
   ```

   Companion edits live in `references/post-scaffold-verification.md` (per-ecosystem invocation block) and `SKILL.md` (Step 1 lookup paragraph).

2. **Temp scaffold dir name has no leading dot.** The shipped skill substituted `{name}=.bootstrap-scaffold` for the `subdir-then-move` and `git-clone` strategies. `create-next-app` rejects names starting with `.` ("name cannot start with a period" — npm naming restriction), so the patched version uses `bootstrap-scaffold` (no leading dot). Search-and-replace across `SKILL.md`, `references/scaffold-merge.md`, `references/handoff-consumer.md`, `references/refusal-protocol.md`, `references/bootstrapper-config.yaml`, `references/verification-log-schema.md`.

The audit trail of the first run lives in `context/changes/bootstrap-verification/verification.md` — the **Skill gaps observed during this run** subsection documents both fixes verbatim.

### Reference repositories

The user has other projects this one may draw patterns from. **Inspiration, not canon** — weigh against this project's own PRD/tech-stack each time. See `context/foundation/reference-repos.md` for the full breakdown of what to inherit vs ignore.

Quick pointer:

- **`wykonczymy`** at `/Users/konradantonik/workspace/yolo/wykonczymy` — production Next.js 16 + React 19 app. Permission scope already granted in `.claude/settings.local.json`. Use for tooling conventions (mise, husky, lint-staged, prettier, vitest, ESLint), component composition patterns, Zustand/TanStack patterns. **Ignore** its Payload CMS layer — this project uses Supabase per `context/foundation/tech-stack.md`.

### Tooling conventions (mirrored from `wykonczymy`)

- **Node**: pinned to 24 via `mise.toml`. Use `mise install` once after cloning.
- **Package manager**: pnpm (lockfile is `pnpm-lock.yaml`).
- **Format**: Prettier 3 with `prettier-plugin-tailwindcss`. Config in `.prettierrc`. Run `pnpm format` (check) or `pnpm format:fix` (write).
- **Lint**: ESLint 9 flat config (`eslint.config.mjs`). Run `pnpm lint`.
- **Tests**: Vitest 4. Specs under `src/__tests__/**/*.test.ts`. Run `pnpm test` / `pnpm test:watch`.
- **Pre-commit**: husky runs `lint-staged` on changed files (eslint --fix + prettier --write for JS/TS, prettier for JSON/CSS/MD).
- **Typecheck**: `pnpm typecheck` runs `tsc --noEmit`.

### shadcn

Initialized with `--preset nova` (CLI default, `radix-nova` style, `neutral` base). Config in `components.json`. After init, `globals.css` was patched to fix the `--font-sans: var(--font-sans)` circular reference (literal `"Geist"` font family names instead — required for Tailwind v4 `@theme inline`, see `vercel-plugin:shadcn` skill).

Add components with `pnpm dlx shadcn@latest add <component>`. To swap the color palette later, replace the `@theme inline` and `:root` / `.dark` blocks in `src/app/globals.css` — token names stay (`--primary`, `--background`, etc.), only OKLCH values change. Use [tweakcn.com](https://tweakcn.com) for visual tuning.

### Deployment + env management (Vercel CLI)

> **DEFERRED (2026-05-26).** Vercel is not needed for local development and has been pushed to deploy time (sprint-plan Phase F). The provisional team-scope linkage and the Vercel-account cleanup are both parked until then. The rest of this section describes the intended workflow for when Vercel comes back into the picture — it is the plan, not the current state. **For local dev right now, env vars live directly in a git-ignored `.env.local`; the "no manual env editing" rule below only applies once env management migrates to `vercel env`.**

User has a Vercel account. **The Vercel CLI is the canonical surface for everything Vercel-touching on this project** — deploys, environment variables, logs, domains, project linking. Heavy use is expected and intentional.

**Hard rule: no manual editing of `.env.local`.** All env vars flow through Vercel:

1. `vercel link` — link the local repo to a Vercel project (one-time, creates `.vercel/`).
2. `vercel env add <NAME>` — interactive prompt: paste value, pick environments (production / preview / development). Repeat per var.
3. `vercel env pull .env.local` — sync down to a gitignored `.env.local`. Re-run any time a var changes upstream.

Adding a new third-party service (Supabase, Resend, etc.) always follows that three-step ritual. Never `echo "FOO=bar" >> .env.local` — it'll be silently overwritten on the next pull and won't propagate to preview / prod deploys.

**Deploys:**

- `vercel` — preview deploy from the current branch (also fires automatically on `git push` once GitHub integration is set up).
- `vercel --prod` — production deploy.
- `vercel logs <url>` — runtime logs for a specific deploy.
- `vercel ls` — list recent deploys for the linked project.

**Project config:** prefer `vercel.ts` (typed) over `vercel.json` when config is needed. See `vercel-plugin:vercel-cli` skill for current syntax — the API has shifted; don't rely on training data.

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
