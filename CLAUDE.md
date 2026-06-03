# CLAUDE.md — Claude Code entry point

**Read @AGENTS.md first — it is the canonical, cross-tool onboarding** (the bare `@AGENTS.md` above is a Claude Code import, so its content is inlined here): hard rules (pnpm-not-npm, Next.js-16-is-different, App Router), structure, commands, style/conventions, testing, commits/CI, pnpm specifics, tooling tripwires, and Vercel state. This file adds only the 10x-workflow-local tracking below, plus the auto-managed 10x-cli lesson block.

> Also active in Claude Code: the user's path-scoped global rules in `~/.claude/rules/*` (`typescript`/`react`/`styling` conventions + `general`/`general_persona`/`learning`/`english_refinement`). These are the **single source** — AGENTS.md deliberately does **not** restate them (Cursor imports them via its config-import toggle; mirror to `~/.codex/AGENTS.md` if Codex is adopted).

## Course & lesson progress (10xDevs 3.0) — as of 2026-06-02

The `@przeprogramowani/10x-cli` sentinel at the **bottom** of this file is the currently-fetched lesson bundle (now **m2l4**, which added `/10x-frame` + `/10x-research`; m2l5 markdown also fetched but not yet worked), auto-managed by `10x get` and rewritten on every fetch. Never hand-edit inside its BEGIN/END markers.

Live course structure (`10x list`):

| Module | Title                                | Lessons | State                 | This project                                |
| ------ | ------------------------------------ | ------- | --------------------- | ------------------------------------------- |
| M0     | Prework                              | 1       | unlocked              | n/a                                         |
| M1     | Agentic Environment                  | 5       | unlocked              | **L1–L5 done (scaffold live)**              |
| M2     | 10xDevs Workflow                     | 5       | unlocked (2026-05-25) | **m2l1–m2l3 done; F-01 shipped + archived** |
| M3     | AI Development Quality & Maintenance | 5       | unlocked (2026-06-01) | not fetched                                 |
| M4     | Large Scale & Legacy Projects        | 5       | locked → 2026-06-08   | —                                           |
| M5     | AI-Native Teamwork                   | 5       | locked → 2026-06-15   | —                                           |

- **Done:** m1l1 (`shape-notes.md` + `prd.md`), m1l2 (`tech-stack.md`), m1l3 (scaffold + `verification.md`), **m1l4 complete** (`/10x-agents-md` → canonical `AGENTS.md`; `/10x-rule-review` on both rule files + trims; `/10x-lesson` → `context/foundation/lessons.md` created).
- **m1l5 complete (2026-06-01):** `/10x-infra-research` → `context/foundation/infrastructure.md` (**Vercel** chosen). Scaffold **deployed to production** under personal scope `eggplants-projects-07c20257` (git-connected; live at `https://coding-learning-companion-theta.vercel.app`); deploy record in `context/deployment/deploy-plan.md`. Region set to `fra1` (EU, Supabase co-location).
- **m2l1 done (2026-06-01):** `/10x-roadmap` → `context/foundation/roadmap.md` — vertical-first, `main_goal: speed`, `top_blocker: time`, north star **S-03 close-recall-loop**; 2 foundations (F-01 auth, F-02 persistence+RLS, both `ready`) + 5 slices, 22/22 must-have FRs covered, 0 blocked. **m2l1 optional half done (2026-06-02):** Linear MCP at project scope (`.mcp.json`), OAuth done; `roadmap.md` synced to Linear project **Coding Learning Companion** (team `Ex-plant`/`EX`, target 2026-06-10) — 7 roadmap issues **EX-359→EX-365** (F-01, F-02, S-01→S-05) with `foundation`/`slice`/`north-star` labels, 3 milestones (Foundations / Recall loop / Account lifecycle), and `blocked by` dependency relations encoding the build order; EX-363 (north star) flagged Urgent. All in Backlog. `roadmap.md` stays source of truth; Linear mirrors it (sync status as you work changes). **m2l2 done (2026-06-02):** full chain `/10x-new` → `/10x-plan` → `/10x-implement` run for **F-01 `minimal-auth-and-session`** (EX-359); `change.md` status **archived**. All 5 phases implemented & committed: (1) local Supabase stack + `.env.local`; (2) SSR clients + **`proxy.ts`** (Next 16 renamed `middleware`→`proxy`, nodejs runtime); (3) **TanStack Form** `useAppForm` (mirrored from `wykonczymy`, `@tanstack/react-form@^1.33.0`) + Server Actions + shadcn auth pages; (4) gating via `proxy.ts` + `(protected)` layout; (5) **Playwright E2E** (`e2e/auth.spec.ts`, `pnpm test:e2e`, system Chrome) — 6 specs green ×2. Auth code migrated to **feature-first layout** (`src/features/auth/{schemas,actions,types,validate}`; forms in `src/components/forms/`); email callback is **`/api/auth/confirm`** (route handlers live under `app/api/`, per the `feature-first-structure` skill). **m2l3 done (2026-06-02):** `/10x-impl-review` scorecard on F-01 (0 critical / 2 warnings / 5 observations) → triaged: **fixed** F1 (OTP-`type` allow-list in `/api/auth/confirm`), F2 (proxy exact-or-subpath match, no `startsWith` bleed), F3 (`verifyOtp` try/catch), F4 (matcher `/api` comment), F7 (`schema.ts`→`schemas.ts` + 9 importers); **dismissed** F5 (dashboard double `getUser`, verified benign); **skipped** F6. Report at `reviews/impl-review.md` (prior `/code-review` preserved as `reviews/impl-review-code-review.md`). `/10x-archive` → **F-01 archived**; EX-359 **Done**. **m2l4 planning chain run for F-02 (2026-06-03):** full research-backed chain on **F-02 `persistence-and-isolation`** (EX-360, moved **In Progress**) — `/10x-new` → `/10x-research` (internal: 3 parallel sub-agents over F-01's Supabase wiring/env/conventions; external: **Context7** `/supabase/supabase` for RLS + typegen idioms; exa MCP wired (session-level, API-key auth so headless-safe) but unused for this change) → `/10x-plan` → `/10x-plan-review`. `change.md` status **plan_reviewed**; verdict **REVISE → SOUND** after triage (1 critical/1 warning/1 observation, all fixed). Plan locks: single first migration (`notes`→`topic_checks`→`review_events`, FK cascade, `user_id … default auth.uid()`), per-action RLS using `(select auth.uid())` + btree indexes incl. `(user_id, due_at)`; SM-2 scheduling columns on `topic_checks` present-but-unwritten (write path deferred to S-03); `review_events.rating` **SM-2 0–5** (locked); `Database` typegen → `src/lib/supabase/types.ts` + `<Database>` on both factories; feature-local `{data,error}` table wrapper + thin **injectable** read helpers; two-account isolation **Playwright** test. New `lessons.md` entry: in Playwright, auth a supabase-js client via `signInWithPassword` (not browser-cookie reuse) + load `.env.local` in `playwright.config.ts`. Artifacts: `context/changes/persistence-and-isolation/{change,research,plan,plan-brief}.md` + `reviews/plan-review.md`. **Next:** `/10x-implement persistence-and-isolation phase 1` (the migration). Lesson source: `lessons/m2/`.
- **Build axis (separate from lessons):** **Supabase wired** via Vercel Marketplace integration (env on prod+preview; first prod deploy done). Local Supabase stack, `src/lib/supabase` helpers, `proxy.ts`, and auth pages are **shipped** under F-01 (archived: `context/archive/2026-06-02-minimal-auth-and-session/`); first migration still belongs to F-02, not F-01. **Supabase CLI is now a mise tool** (`supabase = "2.101.0"` in `mise.toml`), not an npm dep — run `mise install` to provision it. NOTE: `@context/changes/v1-sprint-plan/plan.md` (deadline 2026-06-10) is the **prior, time-boxed/horizontal** plan; the m2l1 `roadmap.md` (vertical-first) supersedes it as the sequencing source once generated.

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
