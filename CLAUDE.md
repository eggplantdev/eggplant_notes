# CLAUDE.md — Claude Code entry point

**Read @AGENTS.md first — it is the canonical, cross-tool onboarding** (the bare `@AGENTS.md` above is a Claude Code import, so its content is inlined here): hard rules (pnpm-not-npm, Next.js-16-is-different, App Router), structure, commands, style/conventions, testing, commits/CI, pnpm specifics, tooling tripwires, and Vercel state. This file adds only the 10x-workflow-local tracking below, plus the auto-managed 10x-cli lesson block.

> Also active in Claude Code: the user's path-scoped global rules in `~/.claude/rules/*` (`typescript`/`react`/`styling` conventions + `general`/`general_persona`/`learning`/`english_refinement`). These are the **single source** — AGENTS.md deliberately does **not** restate them (Cursor imports them via its config-import toggle; mirror to `~/.codex/AGENTS.md` if Codex is adopted).

## Course & lesson progress (10xDevs 3.0) — as of 2026-06-01

The `@przeprogramowani/10x-cli` sentinel at the **bottom** of this file is the currently-fetched lesson bundle (now **m2l2**, which cumulatively shipped the m1l5 + m2 skills), auto-managed by `10x get` and rewritten on every fetch. Never hand-edit inside its BEGIN/END markers.

Live course structure (`10x list`):

| Module | Title                                | Lessons | State                 | This project                          |
| ------ | ------------------------------------ | ------- | --------------------- | ------------------------------------- |
| M0     | Prework                              | 1       | unlocked              | n/a                                   |
| M1     | Agentic Environment                  | 5       | unlocked              | **L1–L5 done (scaffold live)**        |
| M2     | 10xDevs Workflow                     | 5       | unlocked (2026-05-25) | **m2l1 done (roadmap.md); m2l2 next** |
| M3     | AI Development Quality & Maintenance | 5       | unlocked (2026-06-01) | not fetched                           |
| M4     | Large Scale & Legacy Projects        | 5       | locked → 2026-06-08   | —                                     |
| M5     | AI-Native Teamwork                   | 5       | locked → 2026-06-15   | —                                     |

- **Done:** m1l1 (`shape-notes.md` + `prd.md`), m1l2 (`tech-stack.md`), m1l3 (scaffold + `verification.md`), **m1l4 complete** (`/10x-agents-md` → canonical `AGENTS.md`; `/10x-rule-review` on both rule files + trims; `/10x-lesson` → `context/foundation/lessons.md` created).
- **m1l5 complete (2026-06-01):** `/10x-infra-research` → `context/foundation/infrastructure.md` (**Vercel** chosen). Scaffold **deployed to production** under personal scope `eggplants-projects-07c20257` (git-connected; live at `https://coding-learning-companion-theta.vercel.app`); deploy record in `context/deployment/deploy-plan.md`. Region set to `fra1` (EU, Supabase co-location).
- **m2l1 done (2026-06-01):** `/10x-roadmap` → `context/foundation/roadmap.md` — vertical-first, `main_goal: speed`, `top_blocker: time`, north star **S-03 close-recall-loop**; 2 foundations (F-01 auth, F-02 persistence+RLS, both `ready`) + 5 slices, 22/22 must-have FRs covered, 0 blocked. **m2l1 optional half done (2026-06-02):** Linear MCP at project scope (`.mcp.json`), OAuth done; `roadmap.md` synced to Linear project **Coding Learning Companion** (team `Ex-plant`/`EX`, target 2026-06-10) — 7 roadmap issues **EX-359→EX-365** (F-01, F-02, S-01→S-05) with `foundation`/`slice`/`north-star` labels, 3 milestones (Foundations / Recall loop / Account lifecycle), and `blocked by` dependency relations encoding the build order; EX-363 (north star) flagged Urgent. All in Backlog. `roadmap.md` stays source of truth; Linear mirrors it (sync status as you work changes). **m2l2 next:** `/10x-new` + `/10x-plan` starting with **F-01 `minimal-auth-and-session`** (EX-359; highest fan-out; F-02/EX-360 runs in parallel). m2-chain skills fetched. Lesson source: `lessons/m2/`.
- **Build axis (separate from lessons):** **Supabase wired** via Vercel Marketplace integration (env on prod+preview; first prod deploy done). Local Supabase + first migration / `src/lib` helpers / auth pages still pending. NOTE: `@context/changes/v1-sprint-plan/plan.md` (deadline 2026-06-10) is the **prior, time-boxed/horizontal** plan; the m2l1 `roadmap.md` (vertical-first) supersedes it as the sequencing source once generated.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 2, Lesson 2

Turn one roadmap item into the first implementation cycle with the **change planning chain**:

```
/10x-roadmap -> /10x-new -> /10x-plan -> /10x-plan-review -> /10x-implement
```

`/10x-new`, `/10x-plan`, `/10x-plan-review`, and `/10x-implement` are the lesson focus. `/10x-frame` and `/10x-research` are not required rituals here; they are escalation paths introduced in the next lesson.

### Task Router - Where to start

| Skill                                  | Use it when                                                                                                                                                                                                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Change setup (lesson focus)**        |                                                                                                                                                                                                                                                                      |
| `/10x-new <change-id>`                 | You selected a roadmap item and need a stable change folder. Creates `context/changes/<change-id>/change.md` so planning, implementation, progress, commits, and later review all share one identity. Use AFTER roadmap selection, BEFORE `/10x-plan`.               |
| **Planning (lesson focus)**            |                                                                                                                                                                                                                                                                      |
| `/10x-plan <change-id>`                | You have a change folder and need a reviewable implementation plan. Reads roadmap context, foundation docs, codebase evidence, and any existing change notes; writes `plan.md` and `plan-brief.md` with phases, file contracts, success criteria, and `## Progress`. |
| **Plan readiness (lesson focus)**      |                                                                                                                                                                                                                                                                      |
| `/10x-plan-review <change-id>`         | You have `plan.md` and need a light pre-code readiness check. Use it to catch missing end state, weak contracts, malformed progress, scope drift, or blind spots before code changes begin.                                                                          |
| **Implementation (lesson focus)**      |                                                                                                                                                                                                                                                                      |
| `/10x-implement <change-id> phase <n>` | You have an approved plan and want to execute one phase with verification, manual gate, commit ritual, and SHA write-back to `## Progress`.                                                                                                                          |
| **Lifecycle closure**                  |                                                                                                                                                                                                                                                                      |
| `/10x-archive <change-id>`             | A change is merged or intentionally closed. Move it out of active `context/changes/` into archive state.                                                                                                                                                             |

### How the chain hands off

- `/10x-new` creates the durable change identity.
- `/10x-plan` turns that identity into an implementation contract.
- `/10x-plan-review` checks the plan before the agent mutates code.
- `/10x-implement` executes one planned phase, verifies, asks for manual confirmation when needed, commits, and records progress.

### Lesson boundaries

- Plan is the default router after roadmap selection. Start with `/10x-plan` unless the problem is unclear or external evidence is blocking.
- Do not run `/10x-frame + /10x-research` as ceremony for every change.
- Do not turn this lesson into a full end-to-end product build. A checkpoint with a planned and partially or fully implemented stream is valid.
- Code review of the implemented diff belongs to Lesson 3 via `/10x-impl-review`.
- Lifecycle closure via `/10x-archive` after a change is merged or intentionally closed.

### Paths used by this lesson

- `context/foundation/roadmap.md` - upstream roadmap
- `context/changes/<change-id>/change.md` - change identity
- `context/changes/<change-id>/plan.md` - implementation contract
- `context/changes/<change-id>/plan-brief.md` - compressed handoff
- `context/foundation/lessons.md` - recurring rules and pitfalls
- `docs/reference/contract-surfaces.md` - load-bearing names registry

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
