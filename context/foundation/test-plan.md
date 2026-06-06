# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-06

## 1. Strategy

Tests follow four non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in <area>"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.
4. **Assert the effect, not the 200.** A test must assert the observable or
   persisted result of a scenario — the rescheduled due-date, the written
   row, the denied access — never the fact that an action "returned
   success." A returned 200 (or a green optimistic UI) is not proof a
   side-effect happened; a swallowed error can return success while the real
   work failed. The oracle for the expected effect comes from the risk /
   requirement, never from the code under test.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/` (hand-written only; excludes docs, fixtures, archive, build output, and 10x-cli-managed files).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                                                                  | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A user reads or writes **another user's** notes, cards, subjects, settings, or review events — an RLS gap on a table or an RPC running at the wrong privilege                            | High   | Med        | PRD v2 Guardrails (isolation #1); interview Q1 + Q4; hot-spot dirs `src/features/subjects/` (67/30d), `src/features/auth/` (35/30d)                |
| 2   | After a self-rating, a card **reschedules wrong or drops out of the due set** — FSRS state corrupts silently and the recall loop stops surfacing the right cards                         | High   | Med        | PRD v2 Guardrails (recall loop #2); roadmap north-star S-03; hot-spot dirs `src/features/review/` (33/30d), `src/features/review-events/` (19/30d) |
| 3   | **AI-generated notes/cards commit without schema-validation or the preview gate** — malformed or hallucinated rows written to the user's data                                            | High   | Med        | interview Q3 + Q4; roadmap S-19 Phase 2 (unbuilt — forward-looking)                                                                                |
| 4   | **Uncontrolled token spend** — an AI generation runs with no size or budget ceiling; a large file or a repeated trigger burns the user's OpenRouter credits unboundedly (resource abuse) | High   | Med        | interview Q2 (explicit top fear); roadmap S-19 Phase 2 (unbuilt — forward-looking)                                                                 |
| 5   | **OpenRouter credential leaks** into logs, error bodies, or the client bundle, or **survives account deletion** (FR-006 requires its removal)                                            | High   | Med        | interview Q4; roadmap S-19 connect; PRD v2 Access Control + archived S-05 delete-account (unbuilt — forward-looking)                               |
| 6   | A Server Action mutation **fails but the UI shows success** (the `reorderNote` silent-revert class) — data loss with no user-visible signal                                              | Med    | Low        | roadmap S-16 motivation (class closed; residual risk is regression of the signal mechanism)                                                        |

**Impact × Likelihood rubric.** High impact = user loses access, data, or money. High likelihood = area changes weekly or we have already been burned here. R3–R5 are scored Medium likelihood despite living in unbuilt code because the roadmap puts S-19 next and the interview ranked them the dominant fears; they activate when that surface is built (see §3 Phases 4–5).

**Abuse / security lens.** The product has auth and accepts user input (markdown upload), and will hold a BYOK secret. Coverage: authorization/IDOR → R1; untrusted input / validation parity → R3; secret/PII leakage → R5; resource abuse → R4.

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                 | Must challenge                                                                                       | Context `/10x-research` must ground                                                                                     | Likely cheapest layer                                      | Anti-pattern to avoid                                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1   | A non-owner is **denied** both read and write on every table, and every RPC runs at the intended privilege (invoker vs definer)             | "Owner-can-read-own passes" does **not** imply "non-owner is denied"                                 | Each table's RLS policy set; every RPC's `SECURITY` mode; which client (RLS-scoped vs service-role) each read path uses | integration (two-user DB) + extend e2e `isolation.spec.ts` | Testing only the happy owner path and never the cross-user denial                                                                                                 |
| #2   | Rating Good lengthens / Again shortens the next-due interval, and the card correctly leaves and re-enters the due set across day boundaries | "The action returned success" does **not** imply "the FSRS state rescheduled correctly"              | The rating→FSRS-rating mapping; the due-query predicate and its timezone handling; what a review event persists         | unit (mapping) + integration (due-query + reschedule)      | **Oracle problem** — asserting the expected interval by copying FSRS's own output (tautological); the oracle is FSRS direction semantics, not the code under test |
| #3   | Every AI-produced note/card passes schema validation and the user preview/edit gate **before** any DB write                                 | "The model returned JSON" does **not** imply "the JSON is a valid, safe row"                         | The structured-output schema; where validation runs; whether commit is reachable without passing the preview gate       | unit (schema) + integration (commit path)                  | "Test the AI" — assert the _contract and gate behavior_, never the model's wording                                                                                |
| #4   | A generation request refuses or truncates past a defined token/size ceiling, and cannot be looped to bypass it                              | "Users won't upload huge files" / "one call is cheap" — cost compounds on repeat                     | Where the ceiling is enforced; what counts toward it (input size, output tokens, call count)                            | integration on the generation entry point                  | Testing only a small happy-path input and never the over-limit refusal                                                                                            |
| #5   | The key never appears in logs, error responses, or the client bundle, and is gone after account deletion                                    | "It saves correctly" does **not** imply "it is absent from error paths" or "it is removed on delete" | Where the key is stored and how it is encrypted; the delete-account cascade; what error/log paths can echo it           | integration (storage + delete) + response/bundle scan      | Testing only that the key saves, never that it is absent on error or removed on delete                                                                            |
| #6   | A failing mutation surfaces a user-visible signal (toast or inline error) rather than a silent optimistic revert                            | "The optimistic UI updated" does **not** imply "the write succeeded"                                 | The action-result plumbing that converts a failure into a surfaced signal                                               | one thin e2e on a representative failing action            | Testing toast styling/copy/animation (that is §7 negative space)                                                                                                  |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                         | Goal (one line)                                                                         | Risks covered | Test types                                                       | Status      | Change folder |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------- | ----------- | ------------- |
| 1   | RLS isolation depth                | Prove no cross-user read/write on any table and every RPC at the right privilege        | #1            | integration + e2e                                                | not started | —             |
| 2   | Recall-loop scheduling integrity   | Prove reschedule direction and due-set membership are correct after a rating            | #2            | unit + integration                                               | not started | —             |
| 3   | Mutation-feedback regression guard | Prove no Server Action mutation can fail silently                                       | #6            | e2e                                                              | not started | —             |
| 4   | AI generation safety               | Prove AI output is schema-validated, preview-gated, and bounded by a token/size ceiling | #3, #4        | unit + integration; Playwright MCP exploratory on the preview UI | not started | —             |
| 5   | OpenRouter credential lifecycle    | Prove the BYOK key never leaks and is removed on account deletion                       | #5            | integration + response/bundle scan                               | not started | —             |

**Status vocabulary** (fixed — parser literals): `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`.

Phases 1–3 are testable against today's code. Phases 4–5 are **gated on S-19 Phase 2** (the AI surface is unbuilt) — they remain `not started` until that feature lands, then activate. This ordering is deliberate: the operator's top fears live in unbuilt code, so the plan names them now and attacks them when there is code to attack.

## 4. Stack

The classic test base for this project. AI-native tools carry a `checked:`
date so future readers can see which lines need re-verification.

| Layer                | Tool                                 | Version | Notes                                                                                                                                               |
| -------------------- | ------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit + integration   | Vitest                               | ^4.0.18 | 14 specs in `src/__tests__/`; pure-logic + schema coverage today                                                                                    |
| e2e                  | Playwright                           | ^1.60.0 | 17 specs in `e2e/`; system Chrome, production build on port 3100, no DB reset (self-seeding via real sign-up)                                       |
| API mocking          | none yet                             | —       | No MSW. Integration tests run against the local Supabase stack, not mocked HTTP                                                                     |
| accessibility        | none yet                             | —       | No axe-core wired; not gating any current risk                                                                                                      |
| scheduling engine    | ts-fsrs                              | ^5.4.1  | Library under integration (R2) — test our integration, not its internal math (§7)                                                                   |
| (optional) AI-native | Playwright MCP — checked: 2026-06-06 | n/a     | Exploratory/multimodal e2e on the AI preview UI (Phase 4). When NOT to use: any flow a deterministic schema/integration test already covers cheaply |

**Stack grounding tools (current session):**

- Docs: Context7 — available; use for current Next.js 16 / Playwright / ts-fsrs / Supabase APIs at per-phase planning; checked: 2026-06-06
- Search: Exa.ai — available; use for tool-currency checks (e.g. OpenRouter PKCE contract, token-counting libs) at Phase 4/5 planning; checked: 2026-06-06
- Runtime/browser: Playwright MCP — available; already the e2e surface; candidate exploratory layer for the AI preview UI; checked: 2026-06-06
- Provider/platform: Linear + Supabase MCPs — available; Supabase MCP can verify RLS policies/RPC privilege for Phase 1 gates; Linear mirrors rollout issues; checked: 2026-06-06

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase N" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate                                                 | Where                             | Required?                         | Catches                                                                                       |
| ---------------------------------------------------- | --------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| lint + typecheck                                     | local (pre-commit) + Vercel build | required                          | syntactic / type drift                                                                        |
| unit + integration                                   | local + CI                        | required after §3 Phase 1         | logic + isolation + scheduling regressions                                                    |
| e2e on critical flows (auth, isolation, recall loop) | local + CI                        | required after §3 Phase 1         | broken critical user paths                                                                    |
| post-edit hook                                       | local (agent loop)                | recommended (configured in M3 L3) | regressions at edit time                                                                      |
| mutation-verification (test proven to fail)          | local on changed files            | recommended after §3 Phase 1      | tautological tests that pass even when the code is broken (assertion mirrors, oracle problem) |
| AI output-contract gate                              | local + CI                        | required after §3 Phase 4         | unvalidated/over-budget AI generations                                                        |
| credential-leak scan                                 | CI                                | required after §3 Phase 5         | secret in logs/responses/bundle                                                               |
| pre-prod manual smoke (incl. sample-data load)       | between merge + prod              | optional                          | environment-specific + demo-path failures                                                     |

CI today is Vercel's GitHub integration (preview on push, prod on merge); there is no `.github/workflows/*`. Gates marked "CI" become enforceable when a CI runner is wired — that wiring is owned by M1 L5 / M2 L5, not this plan.

Mutation-verification is the discipline of confirming a test actually fails when the code it guards is broken (it catches assertion-mirrors and the oracle problem). Scope it to changed files only (e.g. a mutation runner like Stryker on the diff); a full-suite mutation run is too slow to gate on. Tooling and exact invocation are decided when Phase 1 lands — this row names the discipline, not the config.

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, it reads "TBD — see §3 Phase N."

### 6.1 Adding a unit test

- **Location**: `src/__tests__/<name>.test.ts`.
- **Naming**: `<behavior-or-module>.test.ts` (flat dir, kebab-case).
- **Reference test**: `src/__tests__/review-scheduling.test.ts`.
- **Run locally**: `pnpm test`.

### 6.2 Adding an integration test (RLS / two-user)

- TBD — see §3 Phase 1 (cross-user denial pattern against the local Supabase stack).

### 6.3 Adding an e2e test

- **Location**: `e2e/<feature>.spec.ts`.
- **Self-seeding**: each spec signs up a fresh per-run `uniqueEmail` (`e2e/helpers.ts`); specs do not reset the DB.
- **Reference test**: `e2e/isolation.spec.ts` (two-account), `e2e/review.spec.ts` (recall loop).
- **URL-multiselect filters** (subject/state/maturity): `e2e/memory-card-filters.spec.ts` — target via `data-testid="filter-<key>"`, assert list narrowing + AND composition (authored in `memory-card-state-maturity-filters` Phase 3).
- **Run locally**: `pnpm test:e2e` (needs `supabase start` up).

### 6.4 Adding a test for the recall loop

- TBD — see §3 Phase 2 (rating→reschedule direction + due-set membership; oracle from FSRS semantics, not the code).

### 6.5 Adding a test for the AI generation surface

- TBD — see §3 Phase 4 (schema-validate + preview-gate + token/size ceiling).

### 6.6 Per-rollout-phase notes

(Optional. After each phase lands, `/10x-implement` appends a 2–3 line note here capturing anything surprising the phase taught.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the Phase 2 interview (Q5). Future contributors
should respect these unless the underlying assumption changes.

- **Presentational / UI polish** (toast visuals/copy/animation, motion, nav shell, progress-bar glow, celebration dialog) — low blast radius. **Exception:** keep the one e2e (Phase 3) that a failed mutation surfaces _some_ signal — that is the lived `reorderNote` lesson, not decoration. Re-evaluate if a visual regression ever causes data loss. (Source: interview Q5.)
- **Seed / sample-data internals** (`supabase/seed.sql`, `generate-section-seed.mjs`, the per-user remap) — dev-only + graded-demo convenience, not a production path. Verify by **manual smoke before evaluation** instead. Re-evaluate if sample-data becomes a real onboarding feature. (Source: interview Q5.)
- **Markdown render fidelity** (exact Shiki token colors / markdown-to-HTML output via snapshots) — brittle, breaks on every Shiki bump, catches nothing real. Re-evaluate if token _meaning_ (not color) ever regresses. (Source: interview Q5.)

**Not** excluded: our _integration_ with third-party libraries (FSRS, Supabase, Shiki). We trust their internals; we test that we call them correctly — especially the recall loop (R2), which is the north star.

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-06
- Stack versions last verified: 2026-06-06
- AI-native tool references last verified: 2026-06-06

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes,
- **S-19 Phase 2 (AI surface) lands** — Phases 4–5 move from gated to active and their risk anchors should be re-grounded by `/10x-research`.
