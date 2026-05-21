---
bootstrapped_at: 2026-05-21T07:36:00Z
starter_id: next
starter_name: Next.js
project_name: coding-learning-companion
language_family: js
package_manager: pnpm
cwd_strategy: subdir-then-move
bootstrapper_confidence: verified
phase_3_status: ok
audit_command: pnpm audit --json
---

## Hand-off

```yaml
starter_id: next
package_manager: npm
project_name: coding-learning-companion
hints:
  language_family: js
  team_size: solo
  deployment_target: vercel
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: true
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

Note: the hand-off carried `package_manager: npm`. The user overrode it to `pnpm` at Step 0 (Correct-a-value path). The hand-off file on disk was not modified; the override applies to this run only.

### Why this stack

Solo developer with 4 years of Next.js / React / Tailwind experience shipping a personal coding-learning web app on a 3-week MVP budget. The registry's recommended `(web, js)` lead is the 10xDevs Astro starter, declined in favor of the user's home turf — Next.js with TypeScript — captured via the custom path. Next.js clears all four agent-friendly gates (typed, convention-based, popular in training data, well-documented) with bootstrapper-verified confidence, a stronger confidence rating than the declined Astro starter would have offered. Vercel is the natural deployment target: native home for Next.js, frictionless preview URLs per pull request, zero-config production deploys. CI runs through Vercel's GitHub integration; no `.github/workflows/*` workflow file ships in v1 — Vercel's build-time check is the v1 CI gate, and a GitHub Actions workflow for tests / lint / typecheck becomes a v1.1 concern. Supabase is the planned backend (Postgres + Auth + RLS per the shape-notes "Forward: tech-stack" block), added after scaffold via `@supabase/ssr` per Supabase's Next.js integration docs — roughly a 10–20 minute setup. The five-point self-check came back clean; no Socratic nudge fired. Auth feature flag is true; AI / payments / realtime / background jobs are all out of v1 MVP scope per PRD non-goals.

## Pre-scaffold verification

| Signal      | Value                                            | Severity | Notes                                                   |
| ----------- | ------------------------------------------------ | -------- | ------------------------------------------------------- |
| npm package | create-next-app v16.2.6 published 2026-05-21     | fresh    | resolved from cmd_template                              |
| GitHub repo | not run                                          | n/a      | card docs_url is nextjs.org/docs, not a GitHub URL      |

## Scaffold log

**Resolved invocation**: `npx create-next-app@latest bootstrap-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm`
**Strategy**: subdir-then-move
**Exit code**: 0
**Files moved**: 16 (top-level entries: AGENTS.md, .gitignore, .next, README.md, eslint.config.mjs, next-env.d.ts, next.config.ts, node_modules, package.json, pnpm-lock.yaml, pnpm-workspace.yaml, postcss.config.mjs, public, src, tsconfig.json, plus CLAUDE.md sidelined)
**Conflicts (.scaffold siblings)**: CLAUDE.md.scaffold
**.gitignore handling**: moved silently (absent in cwd)
**.bootstrap-scaffold cleanup**: deleted

Note: the first scaffold attempt with `{name}=.bootstrap-scaffold` was rejected by `create-next-app` ("name cannot start with a period" — npm naming restriction). Retried with `{name}=bootstrap-scaffold` (no leading dot). The substitution rule in `scaffold-merge.md` § "Substitution rules" assumes the dot-prefixed name is universally acceptable; `create-next-app` is a counter-example. Recorded for the skill's future fix.

## Post-scaffold audit

**Tool**: `pnpm audit --json` (substituted in place of the configured `npm audit --json` because the user picked pnpm and there is no `package-lock.json` for npm to read; see the skill-gap note in `## Hints recorded but not acted on`)
**Summary**: 0 CRITICAL, 0 HIGH, 1 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/0/0 direct of total 0/0/1/0 — the one finding is transitive (postcss reached via next)

#### CRITICAL findings

none

#### HIGH findings

none

#### MODERATE findings

- **postcss** v8.4.31 — GHSA-qx2v-qp2m-jg93 / CVE-2026-41305. XSS via unescaped `</style>` in CSS stringify output. Reached as `. > next > postcss`. Fix: upgrade postcss to ≥ 8.5.10. CVSS 6.1.

#### LOW / INFO findings

none

## Hints recorded but not acted on

| Hint                                | Value                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| bootstrapper_confidence             | verified                                                                                    |
| quality_override                    | false                                                                                       |
| path_taken                          | custom                                                                                      |
| self_check_answers                  | typed=true, from_official_starter=true, conventions=true, docs_current=true, can_judge_agent=true |
| team_size                           | solo                                                                                        |
| deployment_target                   | vercel                                                                                      |
| ci_provider                         | github-actions                                                                              |
| ci_default_flow                     | auto-deploy-on-merge                                                                        |
| has_auth                            | true                                                                                        |
| has_payments                        | false                                                                                       |
| has_realtime                        | false                                                                                       |
| has_ai                              | false                                                                                       |
| has_background_jobs                 | false                                                                                       |

### Skill gaps observed during this run

- **Audit command hardcoded to `npm`.** `bootstrapper-config.yaml` maps `js → "npm audit --json"` regardless of the user's `package_manager`. On a pnpm-only project this fails with `ENOLOCK` because there is no `package-lock.json`. The skill should derive the audit command from the resolved package manager (`pnpm audit --json` / `yarn npm audit --json` / `npm audit --json`) instead of from `language_family` alone.
- **`{name}=.bootstrap-scaffold` rejected by some CLIs.** `create-next-app` refuses names starting with `.`. The `subdir-then-move` substitution rule needs an escape hatch (`bootstrap-scaffold` with no leading dot) for CLIs that enforce npm naming.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review `CLAUDE.md.scaffold` (the scaffold's CLAUDE.md, sidelined because your CLAUDE.md already existed). Decide whether to keep, merge, or delete it.
- Address the moderate postcss finding by bumping postcss to ≥ 8.5.10 once Next.js publishes a build that pulls a patched version (or by adding a `pnpm.overrides` entry in `package.json`).
- `pnpm dev` to start the Next.js dev server.
