# v1 Sprint Plan — Coding Learning Companion

**Window**: 2026-05-26 → 2026-06-10 (15 calendar days)
**Capacity**: after-hours only, solo. Budget: ~30 hours total (~2 h/day weekdays, ~4 h/day weekends).
**Status**: drafted 2026-05-26. Phase A starts next.

---

## Total estimate vs budget

| Phase | Scope                               | Estimate  |
| ----- | ----------------------------------- | --------- |
| A     | Foundation (Supabase, schema, auth) | ~4 h      |
| B     | Notes CRUD + CodeMirror editor      | ~7 h      |
| C     | Topic checks CRUD                   | ~4 h      |
| D     | Review loop + FSRS integration      | ~7 h      |
| E     | Dashboard polish (streak + heatmap) | ~4 h      |
| F     | Settings, deploy, buffer            | ~6 h      |
|       | **Total**                           | **~32 h** |

Budget margin is thin (~2h over budget). If any phase slips by more than its estimate, hit the cut list below before extending.

---

## Phase A — Foundation (Day 1–2, ~4 h)

Goal: a deployed Supabase project, a schema with RLS, working auth.

| ID  | Task                                                                                                                                                                                              | FRs                       | Est |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | --- |
| A1  | Create Supabase project (cloud). Pull env vars to `.env.local`. Add `@supabase/ssr` + `@supabase/supabase-js`. Wire the App Router server/client/middleware helpers per Supabase's Next.js guide. | infra                     | 1 h |
| A2  | Write the first migration: `notes`, `topic_checks`, `review_events`, plus RLS policies (every row scoped by `auth.uid()`). Run via Supabase CLI; commit migration file.                           | persistence isolation NFR | 2 h |
| A3  | Build sign-up / sign-in / sign-out / password-reset pages with server actions. Redirect signed-out users from gated routes.                                                                       | FR-001 → FR-005           | 1 h |

**Exit criteria**: I can sign up, get redirected to a dashboard route, sign out, sign back in, reset password. The Supabase dashboard shows my user row. RLS blocks reads of other users' rows when tested with two accounts.

---

## Phase B — Notes CRUD (Day 3–5, ~7 h)

Goal: the developer can write a markdown note with code blocks and see it rendered.

| ID  | Task                                                                                                                                                                                        | FRs            | Est   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----- |
| B1  | `/notes` list page. Server-component fetch, empty-state + new-note CTA.                                                                                                                     | FR-011         | 1 h   |
| B2  | `/notes/new` and `/notes/[id]/edit` — markdown editor with CodeMirror 6 + side-by-side live preview. Lazy-load CodeMirror so it doesn't enter the dashboard bundle. Save via server action. | FR-007         | 3 h   |
| B3  | `/notes/[id]` view route — render markdown with `react-markdown` + `shiki` (or `rehype-highlight`) for code blocks.                                                                         | FR-008         | 1.5 h |
| B4  | Note edit / delete server actions. Delete cascades to `topic_checks` (DB-level `ON DELETE CASCADE`).                                                                                        | FR-009, FR-010 | 1.5 h |

**Exit criteria**: end-to-end create → list → view → edit → delete works. Code blocks render with syntax highlighting on TS / Python at minimum.

---

## Phase C — Topic checks CRUD (Day 6–7, ~4 h)

Goal: the user can attach review-able prompts to a note.

| ID  | Task                                                                                                                        | FRs            | Est   |
| --- | --------------------------------------------------------------------------------------------------------------------------- | -------------- | ----- |
| C1  | Attach topic check to a note: form with question + optional example + optional code-block context. Server action to insert. | FR-012         | 1.5 h |
| C2  | Edit + delete topic check via server actions.                                                                               | FR-013, FR-014 | 1 h   |
| C3  | List topic checks under a given note's view.                                                                                | FR-015         | 0.5 h |
| C4  | Display each topic check's `next_due_at` in the note's topic-check list.                                                    | FR-019         | 1 h   |

**Exit criteria**: I can attach a topic check to a note, see it listed with its next-due date, edit the question, delete the topic check.

---

## Phase D — Review loop + FSRS (Day 8–10, ~7 h)

Goal: the recall loop closes. The user reviews a due topic check, rates it, and the next-due date shifts.

| ID  | Task                                                                                                                                                                       | FRs                  | Est   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ----- |
| D1  | Pick + install scheduling algorithm. Lean toward `ts-fsrs` (FSRS-5, Anki's current default). Add a helper that takes `(card_state, rating)` → `(next_state, next_due_at)`. | FR-018               | 1.5 h |
| D2  | Dashboard "due today" list + the bare due-count summary. Server-component query against `topic_checks WHERE next_due_at <= now()`.                                         | FR-016, FR-022       | 1.5 h |
| D3  | `/review/[topic_check_id]` route — question display + Again / Hard / Good / Easy rating buttons.                                                                           | FR-017               | 2 h   |
| D4  | On rating: run FSRS, update topic check's state + `next_due_at`, insert `review_events` row, redirect to next due or "no more due" state.                                  | FR-018 (persistence) | 2 h   |

**Exit criteria**: PRD success criterion #1 passes end-to-end: sign up → create note → attach topic check → time-warp the due date via SQL (or wait) → review → rate → see next interval reschedule.

---

## Phase E — Dashboard polish (Day 11–12, ~4 h)

Goal: motivation visualizations land. Per PRD Socratic note (FR-020/021), these are the **first cuts** if running behind.

| ID  | Task                                                                                                                                                                                             | FRs        | Est |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --- |
| E1  | Streak counter — query distinct-day count of `review_events` ending today.                                                                                                                       | FR-020     | 1 h |
| E2  | Calendar heatmap — last 30–90 days. Aggregate review_events by day; render a grid of 7-row × N-week cells, colored by activity intensity. Mobile-responsive (compresses gracefully under 360px). | FR-021     | 2 h |
| E3  | Mobile sweep — 360px viewport, ensure dashboard + review + note view + editor are usable. Editor may degrade to single-pane preview-toggled on narrow.                                           | NFR mobile | 1 h |

**Exit criteria**: dashboard shows streak + heatmap + due count after a session of reviews. PRD success criterion #1 last line passes ("heatmap shows the day, streak counter reads 1").

---

## Phase F — Settings, deploy, buffer (Day 13–15, ~6 h)

| ID  | Task                                                                                                     | FRs    | Est |
| --- | -------------------------------------------------------------------------------------------------------- | ------ | --- |
| F1  | Settings page: account deletion (with confirm). Server action invokes `auth.admin.deleteUser` + cascade. | FR-006 | 2 h |
| F2  | Marketing landing page (signed-out home). Minimal — name, one-line pitch, sign-up CTA.                   | —      | 1 h |
| F3  | Vercel deploy: production project, env vars, domain (if available). Verify preview deploys work on PRs.  | infra  | 1 h |
| F4  | **Buffer** for bugs, polish, the FSRS edge cases that always show up, second-user smoke test.            | —      | 2 h |

**Exit criteria**: app is live on Vercel, account deletion works, a second person (PRD success criterion: "A second user signs up and uses the product without intervention") can complete the loop without my help.

---

## Cut order if running behind

When (not if) something slips, cut in this order. Each item is justified — none of these break a must-have FR's intent, only its surface polish.

1. **E1 + E2 (streak + heatmap, ~3 h)** — PRD's own Socratic note already flagged these as cuttable. Without them, the loop still works; only the "feels real" dimension is weaker. The user can still see "X due today" via FR-022. Cut both together — half-doing them is worse than doing neither.
2. **F2 (marketing landing, ~1 h)** — replace with a single-line `/` route that redirects signed-out users to `/sign-in`. No FR requires a marketing page.
3. **B3 syntax-highlighter polish (~0.5 h)** — fall back to `rehype-highlight` instead of `shiki` (smaller, faster integration, slightly less pretty).
4. **F1 (self-service account deletion, ~2 h)** — defer to v1.1. Handle deletion requests via email until then. PRD's Socratic note already considered this trade; revisiting it under deadline pressure is rational.
5. **A3 password reset (~30 min)** — use Supabase's hosted password-reset page instead of building a custom form. FR-004 still satisfied.

Total cuttable: ~7 h. With cuts 1+2 applied, budget drops from 32h → 28h; with 1+2+4, 26h. Generous margin once the heatmap goes.

---

## Out-of-plan reminders

These don't fit into the 15-day window but should not be forgotten:

- `.github/workflows/*` for tests / lint / typecheck (PRD says v1.1, but worth a 30-min job after deadline).
- Email verification gate (deferred to v1.1 per FR-002).
- In-app AI code-check + external-LLM credential flow (v1.1 per shape-notes "Forward: tech-stack").
- Companion CLI + per-user API token (v1.1).
- Tag organization (v1.1).
- Push / email reminders (v1.1).

---

## How to use this plan day-to-day

- Strike through tasks as they complete.
- If a task takes >150% of its estimate, stop, add a note explaining why, and re-check the cut order.
- Update the **Status** line at the top of this file each day with the date and the current phase/task.
- This is a working document — edit it as the world changes. The PRD is the contract; the plan is the route.
