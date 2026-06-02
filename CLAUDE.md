# CLAUDE.md — Claude Code entry point

**Read @AGENTS.md first — it is the canonical, cross-tool onboarding** (the bare `@AGENTS.md` above is a Claude Code import, so its content is inlined here): hard rules (pnpm-not-npm, Next.js-16-is-different, App Router), structure, commands, style/conventions, testing, commits/CI, pnpm specifics, tooling tripwires, and Vercel state. This file adds only the 10x-workflow-local tracking below, plus the auto-managed 10x-cli lesson block.

> Also active in Claude Code: the user's path-scoped global rules in `~/.claude/rules/*` (`typescript`/`react`/`styling` conventions + `general`/`general_persona`/`learning`/`english_refinement`). These are the **single source** — AGENTS.md deliberately does **not** restate them (Cursor imports them via its config-import toggle; mirror to `~/.codex/AGENTS.md` if Codex is adopted).

## Course & lesson progress (10xDevs 3.0) — as of 2026-06-02

The `@przeprogramowani/10x-cli` sentinel at the **bottom** of this file is the currently-fetched lesson bundle (now **m2l3**, which cumulatively shipped the m1l5 + m2 skills; m2l4/l5 markdown also fetched but not yet worked), auto-managed by `10x get` and rewritten on every fetch. Never hand-edit inside its BEGIN/END markers.

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
- **m2l1 done (2026-06-01):** `/10x-roadmap` → `context/foundation/roadmap.md` — vertical-first, `main_goal: speed`, `top_blocker: time`, north star **S-03 close-recall-loop**; 2 foundations (F-01 auth, F-02 persistence+RLS, both `ready`) + 5 slices, 22/22 must-have FRs covered, 0 blocked. **m2l1 optional half done (2026-06-02):** Linear MCP at project scope (`.mcp.json`), OAuth done; `roadmap.md` synced to Linear project **Coding Learning Companion** (team `Ex-plant`/`EX`, target 2026-06-10) — 7 roadmap issues **EX-359→EX-365** (F-01, F-02, S-01→S-05) with `foundation`/`slice`/`north-star` labels, 3 milestones (Foundations / Recall loop / Account lifecycle), and `blocked by` dependency relations encoding the build order; EX-363 (north star) flagged Urgent. All in Backlog. `roadmap.md` stays source of truth; Linear mirrors it (sync status as you work changes). **m2l2 done (2026-06-02):** full chain `/10x-new` → `/10x-plan` → `/10x-implement` run for **F-01 `minimal-auth-and-session`** (EX-359); `change.md` status **archived**. All 5 phases implemented & committed: (1) local Supabase stack + `.env.local`; (2) SSR clients + **`proxy.ts`** (Next 16 renamed `middleware`→`proxy`, nodejs runtime); (3) **TanStack Form** `useAppForm` (mirrored from `wykonczymy`, `@tanstack/react-form@^1.33.0`) + Server Actions + shadcn auth pages; (4) gating via `proxy.ts` + `(protected)` layout; (5) **Playwright E2E** (`e2e/auth.spec.ts`, `pnpm test:e2e`, system Chrome) — 6 specs green ×2. Auth code migrated to **feature-first layout** (`src/features/auth/{schemas,actions,types,validate}`; forms in `src/components/forms/`); email callback is **`/api/auth/confirm`** (route handlers live under `app/api/`, per the `feature-first-structure` skill). **m2l3 done (2026-06-02):** `/10x-impl-review` scorecard on F-01 (0 critical / 2 warnings / 5 observations) → triaged: **fixed** F1 (OTP-`type` allow-list in `/api/auth/confirm`), F2 (proxy exact-or-subpath match, no `startsWith` bleed), F3 (`verifyOtp` try/catch), F4 (matcher `/api` comment), F7 (`schema.ts`→`schemas.ts` + 9 importers); **dismissed** F5 (dashboard double `getUser`, verified benign); **skipped** F6. Report at `reviews/impl-review.md` (prior `/code-review` preserved as `reviews/impl-review-code-review.md`). `/10x-archive` → **F-01 archived**; EX-359 **Done**. **Next:** F-02/EX-360 `persistence-and-isolation` (∥-able, now unblocked). Lesson source: `lessons/m2/`.
- **Build axis (separate from lessons):** **Supabase wired** via Vercel Marketplace integration (env on prod+preview; first prod deploy done). Local Supabase stack, `src/lib/supabase` helpers, `proxy.ts`, and auth pages are **shipped** under F-01 (archived: `context/archive/2026-06-02-minimal-auth-and-session/`); first migration still belongs to F-02, not F-01. **Supabase CLI is now a mise tool** (`supabase = "2.101.0"` in `mise.toml`), not an npm dep — run `mise install` to provision it. NOTE: `@context/changes/v1-sprint-plan/plan.md` (deadline 2026-06-10) is the **prior, time-boxed/horizontal** plan; the m2l1 `roadmap.md` (vertical-first) supersedes it as the sequencing source once generated.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 2, Lesson 3

Review AI-generated code before merge with the **implementation review chain**:

```
/10x-implement -> /10x-impl-review -> triage -> (/10x-lesson | fix | skip | disagree)
```

`/10x-impl-review` is the lesson focus. Review is a quality gate, not an instruction to fix every finding.

### Task Router - Where to start

| Skill                          | Use it when                                                                                                                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Code review (lesson focus)** |                                                                                                                                                                                                                                         |
| `/10x-impl-review <change-id>` | You have implemented code and want a structured review before merge. The skill checks plan adherence, scope discipline, safety and quality, architecture, pattern consistency, and success criteria, then presents findings for triage. |
| **Recurring lesson outcome**   |                                                                                                                                                                                                                                         |
| `/10x-lesson`                  | A finding reveals a recurring project rule or agent failure pattern. Record it in `context/foundation/lessons.md` instead of treating it as a one-off note.                                                                             |

### Triage discipline

- Severity says how bad the finding is. Impact says how much the decision matters now.
- Valid outcomes: fix now, fix differently, skip, accept as risk, record as recurring rule (`/10x-lesson`), disagree.
- Fix critical findings. Do not burn hours on low-impact observations just because the agent found them.
- Conscious skipping of low-impact findings is a valid review outcome, not negligence.
- If you disagree with a finding, record why. Wrong agent reasoning is also signal.

### Review boundaries

- This lesson reviews implemented code. It does not create the plan, execute new phases, or teach CI review.
- Testing strategy and quality gates are introduced in Module 3.
- Do not use `/10x-contract` as a triage outcome in this lesson.

### Paths used by this lesson

- `context/changes/<change-id>/plan.md` - expected implementation contract
- `context/changes/<change-id>/reviews/` - review output
- `context/foundation/lessons.md` - recurring lessons

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
