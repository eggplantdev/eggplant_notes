# CLAUDE.md — Claude Code entry point

**Read @AGENTS.md first — it is the canonical, cross-tool onboarding** (the bare `@AGENTS.md` above is a Claude Code import, so its content is inlined here): hard rules (pnpm-not-npm, Next.js-16-is-different, App Router), structure, commands, style/conventions, testing, commits/CI, pnpm specifics, tooling tripwires, and Vercel state. This file adds only the 10x-workflow-local tracking below, plus the auto-managed 10x-cli lesson block.

> Also active in Claude Code: the user's path-scoped global rules in `~/.claude/rules/*` (`typescript`/`react`/`styling` conventions + `general`/`general_persona`/`learning`/`english_refinement`). These are the **single source** — AGENTS.md deliberately does **not** restate them (Cursor imports them via its config-import toggle; mirror to `~/.codex/AGENTS.md` if Codex is adopted).

## Per-slice review gate

For every slice/foundation, the order is: **implement the feature code → review → `/simplify` → _then_ author and run the test layer → archive.** Review and clean up BEFORE the tests exist, so the E2E/unit specs lock in the post-`/simplify` code — don't write tests against code a review is about to reshape. (So the test phase is the last step before archive, not the final implementation phase before the gate.)

1. **Parallel review fan-out** — dispatch agents to run all four read-only checks _at once_ (none mutate, so no conflict), then triage every report in the main thread:
   - `/10x-impl-review` — correctness, drift, pattern compliance (this is the bug hunt too; does NOT clean up).
   - `/tailwind-v4-audit` — pre-v4 syntax, arbitrary values, inline styles.
   - `feature-first-structure` — _inter-module_: the **deletion test** (a feature must be `rm -rf`-able with no orphans) + **no cross-feature deep imports / leaked internals** (`features/x` must not import `features/y/...`; cross-feature code goes through a promoted shared tier, on the 2nd consumer, never the 1st).
   - `/module-cohesion-audit` — _intra-module_: flags grab-bag/god files (types + constants + helpers + domain + component in one), catch-all `utils.ts`, component files exporting more than the component. Complementary to `feature-first-structure`, not redundant — boundaries-between-files vs does-one-file-do-too-much.
2. **`/simplify`** — run after the fan-out, **serial**. It _mutates_ (reuse/simplification/efficiency/altitude), so it can't be in the parallel batch; it cleans up against the triaged findings.
3. **Author & verify green** — only now write the test layer (Playwright E2E, any unit specs) against the cleaned-up code, then run the full suite **last**: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build` (scripts in `@package.json`; e2e needs the local Supabase stack up — see AGENTS.md Testing). Archive a verified-green state.

Then `/10x-archive`. `/simplify` is not optional — the reviews flag but don't clean up, so skipping it ships un-simplified code into the immutable archive.

4. **Post-archive sync (the slice is NOT done until this lands)** — flip the matching Linear issue to Done, then update every doc the change made stale: `roadmap.md ## Done` (auto via `/10x-archive` — this is the single per-slice record), `lessons.md` if a rule emerged, and the Linear ID map below if a new issue was created. **Do NOT add a per-slice narrative to this file** — slice detail lives once, in `roadmap.md ## Done` + the archive. Don't stop at the archive commit.

## Course & lesson progress (10xDevs 3.0) — as of 2026-06-03

The `@przeprogramowani/10x-cli` sentinel at the **bottom** of this file is the currently-fetched lesson bundle (now **m2l4**, which added `/10x-frame` + `/10x-research`; m2l5 markdown also fetched but not yet worked), auto-managed by `10x get` and rewritten on every fetch. Never hand-edit inside its BEGIN/END markers.

Live course structure (`10x list`):

| Module | Title                                | Lessons | State                 | This project                                       |
| ------ | ------------------------------------ | ------- | --------------------- | -------------------------------------------------- |
| M0     | Prework                              | 1       | unlocked              | n/a                                                |
| M1     | Agentic Environment                  | 5       | unlocked              | **L1–L5 done (scaffold live)**                     |
| M2     | 10xDevs Workflow                     | 5       | unlocked (2026-05-25) | **m2l1–m2l4 done; F-01 + F-02 shipped + archived** |
| M3     | AI Development Quality & Maintenance | 5       | unlocked (2026-06-01) | not fetched                                        |
| M4     | Large Scale & Legacy Projects        | 5       | locked → 2026-06-08   | —                                                  |
| M5     | AI-Native Teamwork                   | 5       | locked → 2026-06-15   | —                                                  |

- **Lesson milestones (10x course meta — per-slice _build_ detail is NOT here; see the build-log pointer):** M1 — m1l1 `shape-notes.md`+`prd.md`, m1l2 `tech-stack.md`, m1l3 scaffold+`verification.md`, m1l4 `AGENTS.md`+rule-review+`lessons.md`, m1l5 `infrastructure.md` (Vercel) + first prod deploy (`fra1`). M2 — m2l1 `roadmap.md` + Linear sync, m2l2 first `/10x-new→/10x-plan→/10x-implement` (F-01), m2l3 first `/10x-impl-review`+`/10x-archive` (F-01), m2l4 research-backed chain (`/10x-research`+Context7) on F-02.
- **Source of truth (v2 brownfield re-shape, 2026-06-03):** `@context/foundation/prd-v2.md` (11-section) + `@context/foundation/roadmap.md` (v2). v1 prd/roadmap archived → `context/foundation/archive/`. Model: a **Subject** groups notes; cards (`memory_cards`, `note_id`-linked) are the recall unit; the **card→note path** is the differentiator.
- **Per-slice build log — DO NOT restate slice narratives here.** Every shipped slice has a one-line record in `@context/foundation/roadmap.md` `## Done` (outcome + commits + lesson), status/sequencing in its `## At a glance` table, and a full immutable record at `context/archive/<date>-<change-id>/`. This file points there; the old per-slice paragraphs were collapsed (2026-06-04) to kill duplication.
- **Linear (roadmap is source of truth; Linear mirrors it — flip the matching issue to Done at archive, gate step 4):** F-01 EX-359 · F-02 EX-360 · S-01 EX-361 · S-02 EX-362 · S-03 EX-363 · S-04 EX-364 · S-05 EX-365 · S-06 EX-368 · S-07 EX-370 · S-08 EX-369 · S-09 EX-371 · S-13 EX-375 · S-17 (topic-checks-listing) EX-385.
- **Build axis:** Supabase wired via Vercel Marketplace (env on prod+preview; local stack for dev). Supabase CLI is a **mise** tool (`supabase` in `@mise.toml`), not an npm dep — `mise install` provisions it. The old horizontal `@context/changes/v1-sprint-plan/plan.md` is superseded by the vertical `roadmap.md`.
- **Lessons:** `@context/foundation/lessons.md` is the recurring-rules register — append rules there, never inline them here. Lesson source: `lessons/m2/`.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 3

Lesson 3 is about **hooks** — turning the quality gates from Lesson 1 and the tests from Lesson 2 into automatic, deterministic checks that fire while the agent works. A hook runs outside the model, so it survives context compression, instruction changes, and the model "forgetting". The payoff for agentic hooks specifically: a `PostToolUse` check can feed its result back into the agent's context, so the agent fixes trivial errors (formatting, a missing import, a wrong type) on its own in the next iteration instead of you discovering them minutes later.

```
context/foundation/test-plan.md  (§4 Quality Gates: which check, required when)
        │
        ▼  (assign each gate to the cheapest layer that still gives signal)
   per-edit (agent hooks)  →  pre-commit (git hooks)  →  pre-push  →  CI
        │ lint, format, scoped tests          │ staged       │ heavier    │ integration
        ▼
   exit code + stdout  →  additionalContext  →  agent reacts next turn
```

### Task Router — Which layer for this check

| You want to                                                               | Do this                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React the instant the agent edits a file                                  | A per-edit hook (`PostToolUse` matcher `Write\|Edit` in Claude Code). Right for fast checks: lint/format, and scoped tests on risk-area files. This is the **only** layer that can hand feedback to the agent mid-session.                                                                     |
| Run only the tests that depend on the edited file                         | Parse the path from the hook's stdin (`jq -r .tool_input.file_path`) and run your runner's related-tests mode (`vitest related "$FILE" --run`, `jest --findRelatedTests $FILE`). Gate it on whether the file is a risk area in `test-plan.md`; don't run tests on every helper or config edit. |
| Catch changes that bypassed the agent (manual edits, a teammate's commit) | A pre-commit git hook (Lefthook or Husky+lint-staged) over staged files: lint + typecheck, and tests on staged risk files.                                                                                                                                                                     |
| Run heavier checks before code leaves the machine                         | Pre-push: full typecheck or a broader test set. Anything too slow for per-edit moves here.                                                                                                                                                                                                     |
| Decide where a given gate belongs                                         | Ask: is it fast enough (a few seconds) for per-edit, or should it wait for commit/push/CI? Slow checks block the agent loop on every edit — push them up a layer.                                                                                                                              |
| Use the same hook across tools                                            | The trigger → matcher → handler → signal pattern is the same in Cursor, Codex, Windsurf, and Copilot; only the config file and event names change. See the cross-tool table below.                                                                                                             |

### Hook lifecycle — the universal pattern

Every tool's hooks follow four steps:

1. **Trigger** — an event in the tool (e.g. the agent just saved a file: `PostToolUse`).
2. **Matcher** — a filter deciding whether this hook runs (tool name like `Write`/`Edit`, file type, or a name pattern).
3. **Handler** — the action that runs, usually a shell command.
4. **Signal** — the result returns to the tool. The exit code says pass/fail; stdout can flow into the agent's context as feedback.

### Exit codes and the feedback loop

- **0** — success; the hook passed, continue.
- **2** — blocking error; the agent sees the feedback and should react.
- **anything else** — non-blocking error; logged, but does not interrupt work.

On a blocking failure, stdout flows into the agent's context (in Claude Code via `additionalContext`, capped at 10,000 characters; other tools have similar mechanisms with their own limits). That is why the agent can self-correct: it sees the concrete message — missing type, unimported module, badly formatted line — not just "something failed".

The boundary: the agent reliably fixes **trivial** corrections on its own. When a test fails because of wrong business logic, the hook surfaces it but the agent may not diagnose the real cause — it says "something is off" and tries a trivial fix. If that does not resolve in one or two tries, the signal comes back to you, and the problem may deserve its own change-id with the full `/10x-new → /10x-research → /10x-plan → /10x-implement` workflow.

### Three local layers (plus CI)

| Layer                  | Catches                                                                                                                           | Timing |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Per-edit (agent hooks) | Formatting, simple type errors, failing unit tests on risk files. Only layer that feeds the agent mid-work.                       | ms–s   |
| Pre-commit (git hooks) | What slipped past per-edit: manual edits, files changed outside the hook, checks too slow for per-edit. Operates on staged files. | s      |
| Pre-push               | Heavier checks before pushing to remote (full typecheck, broader test set).                                                       | s–min  |
| CI                     | Integration problems, cross-module dependencies, checks needing infra unavailable locally.                                        | min    |

Local layers do **not** replace CI — CI stays the key verification for shared repo state and environments you don't control. But each local layer that catches an error is one fewer CI round-trip. You don't need all layers from day one: start with one per-edit hook (lint) and one commit gate, add layers as you see what escapes. The quality gates in `test-plan.md §4` decide which checks are worth automating and when; a plan may legitimately defer per-edit hooks if the cost/signal ratio isn't there yet.

### Key rules

- Keep per-edit hooks fast. If a check takes more than a few seconds, move it to commit, push, or CI — a slow per-edit hook blocks the agent loop on every edit. Lint/format are ideal per-edit; full typecheck is often a commit gate in larger projects.
- Run scoped tests, not the whole suite, per edit — only tests related to the edited file, and only when that file is a risk area in `test-plan.md`.
- `related` is a subcommand, not a flag (`vitest related`, not `--related`). Use `--run` so the hook terminates instead of entering watch mode.
- `PostToolUse` fires once per tool use; three edits in one turn fire it three times independently — there is no built-in aggregation.
- The git hook tool (Lefthook vs Husky+lint-staged) is an implementation detail; the rule is the same — run checks on staged files before commit. If Husky already works, don't migrate.
- **Context injection is not universal.** Claude Code, Cursor, Codex, and Copilot (in VS Code) can pass a hook's result to the agent; Windsurf cannot — it can block (exit 2) but can't tell the agent what went wrong.

### The same pattern in every tool

| Tool        | Events | Handlers                               | Context injection | Config                  |
| ----------- | ------ | -------------------------------------- | ----------------- | ----------------------- |
| Claude Code | ~30    | command, http, mcp_tool, prompt, agent | yes               | `.claude/settings.json` |
| Cursor      | ~18    | command, prompt                        | yes               | `.cursor/hooks.json`    |
| Codex       | 10     | command                                | yes               | `.codex/hooks.json`     |
| Windsurf    | 12     | command                                | **no**            | `.windsurf/hooks.json`  |
| Copilot     | ~13    | command, http, prompt                  | yes (VS Code)     | `.github/hooks/*.json`  |

### Lesson boundaries

- This lesson configures hooks and local quality layers only. The hook JSON, `lefthook.yml`, and the per-edit/commit/push layering are the scope.
- Do not write E2E tests, configure Playwright/MCP, or run browser scenarios. That is Lesson 4.
- Do not run the bug-to-fix-to-regression-test debugging workflow. That is Lesson 5.
- Do not change the risk strategy or quality-gate definitions. That is Lesson 1 (`/10x-test-plan`); read current state with `/10x-test-plan --status`.
- Do not write unit/integration test code from scratch here. That is Lesson 2 — hooks only _run_ the tests those lessons produced.
- Do not author CI/CD pipelines. That is Module 1 Lesson 5 / Module 2 Lesson 5; hooks are the local layers in front of CI.

### Paths used by this lesson

- `.claude/settings.json` — hook configuration (`~/.claude/settings.json` global, `.claude/settings.json` project, `.claude/settings.local.json` local overrides). Other tools use their own config file (see the table).
- `lefthook.yml` — pre-commit git hook config (lint + typecheck + tests on `{staged_files}`).
- `context/foundation/test-plan.md` — §4 quality gates decide which checks to automate and at which layer; risk areas decide which edits warrant scoped tests.

<!-- END @przeprogramowani/10x-cli -->
