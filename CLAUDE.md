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

4. **Post-archive sync (the slice is NOT done until this lands)** — flip the matching Linear issue to Done, then update every doc the change made stale: `roadmap.md` (auto via `/10x-archive`), this CLAUDE.md tracking blob, and `lessons.md` if a rule emerged. Don't stop at the archive commit.

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
- **Source of truth (v2 brownfield re-shape, 2026-06-03):** `@context/foundation/prd-v2.md` (11-section) + `@context/foundation/roadmap.md` (v2). v1 prd/roadmap archived → `context/foundation/archive/`. Model: a **Subject** groups notes; cards (`topic_checks`, `note_id`-linked) are the recall unit; the **card→note path** is the differentiator.
- **Per-slice build log — DO NOT restate slice narratives here.** Every shipped slice has a one-line record in `@context/foundation/roadmap.md` `## Done` (outcome + commits + lesson), status/sequencing in its `## At a glance` table, and a full immutable record at `context/archive/<date>-<change-id>/`. This file points there; the old per-slice paragraphs were collapsed (2026-06-04) to kill duplication.
- **Linear (roadmap is source of truth; Linear mirrors it — flip the matching issue to Done at archive, gate step 4):** F-01 EX-359 · F-02 EX-360 · S-01 EX-361 · S-02 EX-362 · S-03 EX-363 · S-04 EX-364 · S-05 EX-365 · S-06 EX-368 · S-07 EX-370 · S-08 EX-369 · S-09 EX-371 · S-13 EX-375.
- **Build axis:** Supabase wired via Vercel Marketplace (env on prod+preview; local stack for dev). Supabase CLI is a **mise** tool (`supabase` in `@mise.toml`), not an npm dep — `mise install` provisions it. The old horizontal `@context/changes/v1-sprint-plan/plan.md` is superseded by the vertical `roadmap.md`.
- **Lessons:** `@context/foundation/lessons.md` is the recurring-rules register — append rules there, never inline them here. Lesson source: `lessons/m2/`.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 2, Lesson 4

Prepare for a harder implementation stream with the **research-backed planning chain**:

```
internal research (/10x-research) + external research (exa.ai, Context7) -> /10x-plan -> /10x-implement -> success
```

The lesson focus is distinguishing internal from external research and using evidence to back planning decisions.

### Task Router - Where to start

| Skill                                                            | Use it when                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Internal research (lesson focus)**                             |                                                                                                                                                                                                                                                |
| `/10x-research <change-id>`                                      | You need evidence from the existing codebase — patterns, conventions, integration points, or existing implementations. Runs parallel sub-agents over the repo and writes structured findings to `research.md`.                                 |
| **External research (lesson focus)**                             |                                                                                                                                                                                                                                                |
| exa.ai                                                           | You need AI-native web search for library comparisons, best practices, or ecosystem context that the codebase cannot answer.                                                                                                                   |
| Context7 (`resolve-library-id` → `get-library-docs`)             | You need live, current documentation for a specific library or framework. Resolves a library ID first, then fetches relevant doc pages.                                                                                                        |
| **Framing spare wheel**                                          |                                                                                                                                                                                                                                                |
| `/10x-frame <change-id>`                                         | The plan won't converge, the plan doesn't deliver expected results, or persistent drift keeps breaking the implementation. Use as an escape hatch on a separate problem (demonstrated on Space Explorers example), not as pre-research ritual. |
| **Planning and execution**                                       |                                                                                                                                                                                                                                                |
| `/10x-plan <change-id>` / `/10x-implement <change-id> phase <n>` | Use the same planning and execution chain from Lesson 2, now with upstream research evidence feeding the plan.                                                                                                                                 |

### Research discipline

- Internal research (`/10x-research`) answers "what does our codebase already do?" — patterns, schemas, conventions, integration points.
- External research (exa.ai, Context7) answers "what should we do?" — library capabilities, API docs, ecosystem best practices.
- Combine both as evidence-backed input to `/10x-plan`. A plan without research evidence on a non-trivial stream is a guess.
- Agent-friendly docs (`llms.txt`, markdown-for-agents, `/md` endpoints) are a quality signal for library selection — libraries that publish agent-readable docs integrate faster.

### `/10x-frame` as spare wheel

Three triggers for reaching for `/10x-frame`:

1. The plan won't converge — research keeps opening more questions instead of narrowing to a contract.
2. The plan doesn't deliver — implementation repeatedly fails to meet success criteria.
3. Persistent drift — the implementation keeps diverging from the plan in ways that suggest the problem was mis-framed.

Demonstrated on a Space Explorers example, not the SRS path. It is an escape hatch, not a mandatory step.

### Paths used by this lesson

- `context/changes/<change-id>/research.md` - internal research output
- `context/changes/<change-id>/frame.md` - framing output when needed
- `context/changes/<change-id>/plan.md` - evidence-backed implementation contract
- `context/foundation/lessons.md` - recurring rules and pitfalls

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
