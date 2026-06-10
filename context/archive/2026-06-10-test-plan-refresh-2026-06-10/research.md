# Test-plan refresh — grounding research (2026-06-10)

Grounding for a DOC refresh of `context/foundation/test-plan.md`. No product code, no new tests proposed. Every code claim cites `file:line`.

## Summary — what's stale + what's newly covered

- **Spec counts are wrong.** §4 says "14 specs in `src/__tests__`" and "17 specs in `e2e/`". Verified actual: **39 unit specs**, **22 e2e specs**. (`find` counts below.)
- **R3 (AI schema + preview gate) is now well covered at the unit layer** — `ai-schemas`, `sanitize-generated`, `prompts` (preview≡builder equivalence), `notes-schema`, `card-schema`, `user-prompts`, `describe-generation-error` all exist. Plus E2E `create-note-with-checks.spec.ts`. Phase 4's schema half is effectively done.
- **R4 (token/size ceiling) over-limit refusal has NO test.** The ceiling IS enforced in code (Zod `.max()` caps: `50_000` chars text/draft, `200` topic, `MAX_PDF_BASE64_CHARS` ≈10 MB) but **zero tests** import the generate actions or assert the over-limit rejection. This is the sharpest remaining gap. There is also **no call-count / repeat-trigger guard** in code at all.
- **R5 (credential leak + delete cascade) is partially covered.** `aes-gcm.test.ts` proves encryption-at-rest round-trip + tamper rejection. The delete cascade exists in SQL (FK `on delete cascade` to `auth.users`) and `delete-account.spec.ts` exercises the delete flow — but **no test asserts the credential row is gone after delete**, and **no error-body / client-bundle leak scan exists**.
- **Token HTTP API is a large NEW untrusted/auth surface not represented in §2.** 8 unit specs + 2 RUN_INTEGRATION specs cover it, including explicit two-user IDOR (`api-tokens.integration` "isolates tenants", spoofed-user_id ignored, foreign-id→404). It converges onto R1 (IDOR) and "untrusted input/validation" but has no §2 row of its own.
- **Phases 6 & 7 specs still exist** (`memory-card-filters.spec.ts`, `markdown-xss.spec.ts`) — `complete` status holds.
- **4 of 5 security-hardening fixes now have regression tests** (auth password-8, contact CRLF, sign-up neutral, delete re-auth). The **`runTableAction` generic-error fix (e82c5b5) has NO test** — no spec imports it.

---

## 1. Test inventory → risk / phase mapping

### Unit specs (39 — `find src/__tests__ -name '*.test.ts*'`)

**R3 — AI output schema-validated + preview-gated (Phase 4, schema half):**

- `ai-schemas.test.ts` — `generatedCardsSchema` / `generatedNotesSchema`: accepts well-formed, rejects missing field / non-array. The structured-output contract guard.
- `sanitize-generated.test.ts` — `keepCompleteCards` / `keepCompleteNotes`: drops blank/whitespace-only items the schema accepts (`src/features/openrouter/utils/sanitize-generated.ts`). Runtime emptiness contract.
- `prompts.test.ts` — `previewPrompt` ≡ the `build*Prompt` the action sends ("what you see is what gets sent"); also `promptOverrideSchema`. This is the **preview-gate** equivalence at unit level.
- `user-prompts.test.ts` — `resolveSystemPrompts` overlay logic + `promptKeyFromPreviewInput` (editable-system-prompts).
- `describe-generation-error.test.ts` — failure-classification contract (timeout, 401/403→reconnect, rate-limit, etc.).
- `notes-schema.test.ts` — `noteInputSchema` / `noteIdSchema` (also a write-path validator, shared by R3 commit + manual note create).
- `card-schema.test.ts` — `cardWithSubjectSchema` (standalone + R3 card write payload).
- `openrouter-models.test.ts` — `normalizeModels` / `filterModels` / `sortModels` / pricing format (model picker; supports R5-adjacent UI, not a risk gate).

**R4 — token/size ceiling: NO TEST.** See §1 R4 detail below.

**R5 — credential leak + delete cascade:**

- `aes-gcm.test.ts` — `encryptSecret`/`decryptSecret`: round-trip, fresh IV per call, throws on tampered auth tag, throws on wrong-length key. Proves **encryption-at-rest**.
- (delete cascade → E2E `delete-account.spec.ts`; see gaps below.)

**Token HTTP API surface (NEW, see §5):**

- `api-token.test.ts` — `generateToken`/`hashToken`: prefix, sha256, raw≠hash, deterministic hash + unique raw.
- `api-token-schemas.test.ts` — `mintTokenSchema` (name validation) + `patchNoteBodySchema`.
- `api-card-body.test.ts` — `noteAttachCardsSchema` vs `cardWithSubjectSchema` branch selection by raw `note_id` presence (guards F1 misroute); cap of 20 cards.
- `api-tokens-queries.test.ts` — `getApiTokens` error/empty/data branches.
- `authenticate-request.test.ts` — JWT-mint failure → structured error → JSON 500 (not bodyless 500). Reproduces the empty-500 bug.
- `request-origin.test.ts` — `originFromHeaders` loopback→http / deployment→https mapping (feeds `/api/skill` BASE + OpenRouter callback_url).
- `proxy-api-gate.test.ts` — proxy does NOT 307 `/api/*` to `/sign-in` (handler enforces auth); still redirects protected PAGEs. **This is the auth-routing guard for the API surface.**
- `api-routes.integration.test.ts` — **RUN_INTEGRATION-gated** (skipped by default; `pnpm test:integration`). Drives REAL route handlers against local Supabase: CRUD, IDOR (foreign-id→404), 401 missing token, 400 malformed body, cascade on delete, PATCH move/unlink semantics. **18 `it`s.**
- `api-tokens.integration.test.ts` — RUN_INTEGRATION-gated. REAL pipeline (resolve_api_token DEFINER + minted JWT + RLS): owner resolution, **tenant isolation (A can't read B)**, spoofed-user_id ignored, expired/revoked/garbage token → 401. **6 `it`s.**

**R2 — recall-loop scheduling (Phase 2):**

- `review-scheduling.test.ts` — FSRS rating mapping (Again=1…Easy=4) + reschedule direction. **Reference test per §6.1.**
- `derive-counts.test.ts` — `nextReviewCounts` / `reviewedTodayCount` / `reviewsThisWeekCount`.
- `format-review-status.test.ts` — due-status formatting (zone-aware).

**R8 — fractional ordering (no phase yet):**

- `midpoint.test.ts` — fractional-ordering math (subject ToC + docs-view sidebar). **Directly the R8 surface** (`reorder-note.ts` shares this), though §2 marks R8 "not yet covered" — midpoint math IS now unit-covered; the e2e reorder-degeneracy path is not.

**R6 — mutation feedback (Phase 3):**

- `toast-result.test.ts` — `toastActionResult` result→toast branching (unit half of the silent-success guard).

**Write-path cores (support R1 + general correctness, no dedicated risk):**

- `update-cores.test.ts` — `updateMemoryCardCore` / `updateNoteCore` query sequences + card fan-out.
- `subject-cores.test.ts` — `createSubjectCore` / `updateSubjectCore`; includes "returns the error as a value on a real PostgREST error".

**Hardening-fix regression tests (see §3):**

- `auth-validate.test.ts` — `credentialsSchema`; "rejects a password shorter than 8 characters" → covers fix (4) b0c4120.
- `contact-schema.test.ts` — "rejects a subject with a newline (email header injection)" `'Hi\r\nBcc: ...'` → covers fix (5) 5814a55.
- `env-schema.test.ts` — build-time env contract; pins `SUPABASE_JWT_SECRET` mandatory (token-API 500 bug).

**List/URL/pagination (read-side, no risk gate):**

- `pagination.test.ts`, `build-url-with-params.test.ts`, `parse-card-filters.test.ts` — list math + filter sanitization (supports Phase 6 read-side).

**Dashboard / misc pure logic (no risk gate):**

- `dashboard-heatmap-matrix.test.ts`, `dashboard-streak.test.ts`, `goal-crossing.test.ts`, `date.test.ts`, `split-markdown.test.ts` (import), `read-file-base64.test.ts`, `sample-data-remap.test.ts`, `skill-template.test.ts` (CI drift pin for served skill constant).

### E2E specs (22 — `find e2e -name '*.spec.ts'`)

| Spec                              | Risk / Phase                                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `isolation.spec.ts`               | R1 — two-account cross-user denial (the §6.3 reference). `LEAK:` assertions on every table.                                               |
| `memory-cards.spec.ts`            | S-02 CRUD + R1 two-account read/write isolation (`LEAK: B sees A memory cards`).                                                          |
| `subjects.spec.ts`                | S-15 + R1 isolation (`LEAK: B sees A subject`).                                                                                           |
| `review.spec.ts`                  | R2 — recall loop north-star; asserts review_event written + due_at pushed + R1 (`LEAK: B wrote review_event on A check`). §6.3 reference. |
| `memory-card-review-page.spec.ts` | R2 — due-queue advance after rating.                                                                                                      |
| `card-to-note.spec.ts`            | S-08 card→note jump (the differentiator path).                                                                                            |
| `daily-goal.spec.ts`              | goal→dashboard (read-side).                                                                                                               |
| `dashboard.spec.ts`               | S-04 dashboard shell smoke (shared session).                                                                                              |
| `delete-account.spec.ts`          | R5 (partial — delete flow + re-auth gate); fix (3) af5cab3 regression.                                                                    |
| `action-feedback-toasts.spec.ts`  | R6 — mutation surfaces a toast (navigated + return-only seams). Phase 3.                                                                  |
| `markdown-xss.spec.ts`            | R7 / Phase 7 — inert markdown render. **complete.**                                                                                       |
| `memory-card-filters.spec.ts`     | Phase 6 — state/maturity filters. **complete.**                                                                                           |
| `memory-cards-listing.spec.ts`    | S-17 standalone listing + subject filter.                                                                                                 |
| `memory-cards-overview.spec.ts`   | charts regression guard (read-side).                                                                                                      |
| `standalone-memory-cards.spec.ts` | standalone cards data-model invariants.                                                                                                   |
| `notes.spec.ts`                   | S-01 note CRUD.                                                                                                                           |
| `notes-subject-filter.spec.ts`    | subject-tied note + server-side filter.                                                                                                   |
| `list-search.spec.ts`             | server search + pagination + sidebar filter.                                                                                              |
| `import-notes.spec.ts`            | S-19 Phase 1 markdown import (a non-AI untrusted source for R7).                                                                          |
| `auth.spec.ts`                    | F-01 auth path (Mailpit).                                                                                                                 |
| `sample-data.spec.ts`             | S-12 load/clear demo flow.                                                                                                                |

### R4 detail — over-limit refusal has NO test (sharpest gap)

The ceiling **is enforced in code**:

- `src/features/openrouter/actions/generate-notes.ts:19-20` — `const MAX_PDF_BYTES = 10 * 1024 * 1024` / `MAX_PDF_BASE64_CHARS = Math.ceil(MAX_PDF_BYTES / 3) * 4`.
- `generate-notes.ts:29` — `text: z.string().trim().min(1,...).max(50_000)`; `:34` topic `.max(200)`; `:44` `dataBase64 ... .max(MAX_PDF_BASE64_CHARS, 'PDF is too large (max 10 MB).')`.
- `src/features/openrouter/actions/generate-cards.ts:34` topic `.max(200)`; `:43` `content: ....max(50_000)`.
- `src/features/openrouter/prompt-schemas.ts:11` `const MAX_PROMPT_CHARS = 100_000` applied to system/prompt overrides (`:17-26`).

But: `grep` for `MAX_PROMPT_CHARS|50_000|MAX_PDF|too large|100_000|over.?limit` across `src/__tests__/` returns **nothing**, and **no test imports `generate-cards`/`generate-notes`**. So:

- **No test asserts the over-limit refusal** at the generation entry point.
- **No call-count / repeat-trigger ("loop to bypass") guard exists in code** — the §2 R4 "cannot be looped to bypass it" criterion is unmet by code, so untestable as-is. There is a per-generation timeout (`GENERATION_TIMEOUT_MS`, `AbortSignal.timeout`, `generate-cards.ts:88`) but that bounds latency, not spend/repeat.

### R5 detail — storage + cascade verified in code; gaps in tests

- **Storage/encryption:** `src/features/openrouter/credential.ts:18-24` selects `key_ciphertext, key_iv, key_auth_tag`; `:35-40` decrypts server-side; comment `:14-16` "they never leave the server". Encryption proven by `aes-gcm.test.ts`.
- **Delete cascade:** `supabase/migrations/20260607153000_openrouter_credentials.sql:7` — `user_id uuid primary key references auth.users (id) on delete cascade`. `delete_account()` (`20260603092554_add_delete_account_rpc.sql:28`) `delete from auth.users where id = (select auth.uid())` — the cascade tears down the credential row. Migration comment `:3-4` confirms intent.
- **Gaps:** (a) `delete-account.spec.ts` asserts "cannot sign in again" but **does NOT assert the `openrouter_credentials` row is gone**; (b) **no error-body or client-bundle leak scan** anywhere (`grep bundle|leak` finds only RLS `LEAK:` E2E assertions, not a secret-in-response/bundle scan). §2 R5 "never appears in logs/error responses/client bundle" is **untested**.

---

## 2. Phase-status reconciliation (§3)

| Phase                                  | Doc status  | Accurate status                           | Evidence                                                                                                                                                                                                                                                                                                            |
| -------------------------------------- | ----------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 RLS isolation depth (R1)             | not started | **partial**                               | E2E `isolation.spec.ts` + per-feature `LEAK:` checks (memory-cards/subjects/review) cover cross-user denial; `api-tokens.integration` "isolates tenants" + `api-routes.integration` foreign-id→404 add API-surface IDOR. Not a dedicated integration two-user RLS-per-table phase, but substantial coverage exists. |
| 2 Recall-loop scheduling (R2)          | not started | **partial**                               | Unit `review-scheduling.test.ts` (mapping+direction) + E2E `review.spec.ts` (event written, due_at pushed) + `memory-card-review-page.spec.ts` (queue advance). The integration due-query/timezone half is thinner.                                                                                                 |
| 3 Mutation-feedback (R6)               | not started | **partial**                               | `toast-result.test.ts` (unit) + `action-feedback-toasts.spec.ts` (e2e, navigated + return-only seams). The imperative reorder-failure seam is "verified manually", not automated.                                                                                                                                   |
| 4 AI generation safety (R3,R4)         | not started | **partial — R3 mostly done, R4 untested** | R3: `ai-schemas`, `sanitize-generated`, `prompts`, `notes-schema`, `card-schema`, `user-prompts`, `describe-generation-error` + `create-note-with-checks.spec`. R4: **no over-limit test, no call-count guard** (see §1 R4).                                                                                        |
| 5 OpenRouter credential lifecycle (R5) | not started | **partial**                               | `aes-gcm` (encryption) + `delete-account.spec` (delete flow). Missing: credential-row-gone-after-delete assertion + leak/bundle scan.                                                                                                                                                                               |
| 6 Memory-card filters                  | complete    | **complete (verified)**                   | `e2e/memory-card-filters.spec.ts` exists.                                                                                                                                                                                                                                                                           |
| 7 Markdown render XSS (R7)             | complete    | **complete (verified)**                   | `e2e/markdown-xss.spec.ts` exists; header comment confirms single RenderMarkdown pipeline, no rehype-raw.                                                                                                                                                                                                           |

**Caveat for §5 doc:** the two integration specs are **default-skipped** (`describe.skipIf(!RUN_INTEGRATION)`), run only via `pnpm test:integration`. So `pnpm test` (the gate) does NOT exercise R1 API-IDOR or the route handlers. Worth a doc note — the coverage exists but is not in the default gate.

---

## 3. Security-hardening fixes — regression coverage

| Fix                                                    | Commit  | Risk           | Regression test?   | Evidence                                                                                                                                                                                                  |
| ------------------------------------------------------ | ------- | -------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (1) sign-up errors → neutral (no enumeration)          | 7f56b2b | R1/auth-abuse  | **NO direct test** | No spec asserts the collapsed sign-up message. `auth-validate.test.ts` covers schema only, not the action's error-collapsing.                                                                             |
| (2) `runTableAction` generic error (no PostgREST leak) | e82c5b5 | R5 error-leak  | **NO test**        | `grep run-table-action\|runTableAction src/__tests__/` → empty. Fix verified in code `src/lib/supabase/run-table-action.ts:25-30` (logs real error, returns `'Something went wrong. Please try again.'`). |
| (3) account delete requires password re-auth           | af5cab3 | R5/S-05        | **YES**            | `delete-account.spec.ts:18-25` — confirm button disabled until DELETE typed AND password re-entered.                                                                                                      |
| (4) min password 6→8 (NIST)                            | b0c4120 | auth           | **YES**            | `auth-validate.test.ts:29` "rejects a password shorter than 8 characters" (`Password must be at least 8 characters`).                                                                                     |
| (5) contact subject rejects CR/LF                      | 5814a55 | injection lens | **YES**            | `contact-schema.test.ts:54` "rejects a subject with a newline (email header injection)" (`'Hi\r\nBcc: attacker@evil.com'`).                                                                               |

So: 3 of 5 covered (2 of them landed AFTER the test plan's "code fixes, not tests" claim — that claim is now **partly stale**). Fixes (1) and (2) remain hardened-but-untested.

---

## 4. Stale-fact list (claim → corrected value → evidence)

1. **§4 row "unit + integration": "14 specs in `src/__tests__/`"** → **39 specs**. (`find src/__tests__ -name '*.test.ts*' | wc -l` = 39.)
2. **§4 row "e2e": "17 specs in `e2e/`"** → **22 specs**. (`find e2e -name '*.spec.ts' | wc -l` = 22.)
3. **§2 R1 Source: hot-spot dirs `src/features/subjects/` (67/30d), `src/features/auth/` (35/30d)** → 30-day churn is now dominated by **`memory-cards` (198), `openrouter` (157), `notes` (151), `dashboard` (115), `subjects` (110), `review` (72), `topic-checks` (49), `auth` (40), `import` (39), `review-events` (29), `api-tokens` (28)**. The cited figures (subjects 67, auth 35) are stale and no longer the top spots. (`git log --since="30 days ago" --name-only` aggregated by feature dir.)
4. **§2 R2 Source: `src/features/review/` (33/30d), `src/features/review-events/` (19/30d)** → now review **72**, review-events **29**.
5. **§1 hot-spot scope citations** generally understate churn — the openrouter feature (157), the heaviest AI surface, is absent from §2 Source columns entirely despite being the R3/R4/R5 anchor.
6. **§2 R3/R4 Source: "roadmap S-19 Phase 2 (built + archived 2026-06-07)"** → understates current state: additional slices `2026-06-08-ai-generation-robustness`, `2026-06-08-editable-system-prompts`, `2026-06-08-note-create-ai-cards`, `2026-06-09-clc-api-crud-endpoints` built AND tested parts of this surface. R3 is now substantially unit-covered (not just "built").
7. **§2 "Security-hardening pass (2026-06-10) … They are code fixes, not tests — so the surfaces are hardened but still untested"** → **partly stale**: fixes (3),(4),(5) now have regression tests (`delete-account.spec`, `auth-validate.test`, `contact-schema.test`). Only (1) and (2) remain untested.
8. **§3 Phase 4 status `not started`** → **partial** (R3 mostly covered; R4 over-limit untested). See §2 table.
9. **§3 Phase 5 status `not started`** → **partial** (encryption + delete flow covered; row-gone + leak scan missing).
10. **§3 Phases 1–3 status `not started`** → all **partial** (see §2 table) — meaningful coverage exists for each.
11. **§3 footnote "Phases 4–5 … remain `not started` as test phases but … no longer gated"** → now stale: real specs cover much of Phase 4 (R3) and part of Phase 5 (R5 encryption + delete).
12. **§8 freshness dates** (Strategy/Stack/AI-native tools "last reviewed/verified: 2026-06-06") → 4 days old; the `checked:` dates in §4 (2026-06-06, 2026-06-07) are all **< 3 months**, so none trip the refresh-by-staleness trigger. No tool `checked:` date is stale — flag none on that axis.
13. **§4 mutation-gate / Stryker, ts-fsrs, Vitest, Playwright versions** — not re-verified against `package.json` in this pass beyond confirming `vitest run` / `playwright test` scripts exist; planner should spot-check versions if the refresh touches §4 version cells. (`test:integration` script confirmed present, `package.json:19`.)

---

## 5. New-risk candidates (surface only — operator decides)

### Token HTTP API surface — candidate for its own §2 row

**Evidence it's a distinct new risk:**

- It is a **new untrusted, unauthenticated-by-default entry surface** (`/api/*`) reachable without a session cookie — `proxy-api-gate.test.ts` exists precisely because the proxy must let unauthenticated `/api/*` through to handlers that self-enforce auth via Bearer token. That is a different threat model from the cookie-session app.
- Distinct auth mechanism: minted-JWT-from-token pipeline (`authenticate-request.test.ts`, `resolve_api_token` DEFINER RPC) — a privilege boundary the §2 risks don't name.
- Distinct input-validation surface: `api-card-body.test.ts` guards a real misroute bug (F1) where a `z.union` fall-through silently re-routed a malformed body. Token-name length cap, 20-card cap, malformed-JSON→400.
- Churn: `api-tokens` 28/30d, plus the surface drove `2026-06-09-clc-api-crud-endpoints`.

**Evidence it fits existing risks by convergence:**

- Its core guarantee is **ownership isolation** = R1 (IDOR). The integration specs assert exactly R1's "non-owner is denied" criterion (`api-tokens.integration` "isolates tenants", spoofed-user_id ignored, `api-routes.integration` foreign-id→404). The token API rides the SAME RLS + minted-JWT path as the app, so R1's "every RPC at the right privilege" already names `resolve_api_token`.
- Its input-validation is the same `validateInput`/Zod boundary R3 names.
- So one could argue it's R1-by-convergence + an input-validation note, not a 9th row.

### topic-checks surface — candidate

- Churn 49/30d (above auth's 40), and it's the recall-unit table feeding R2. But no spec named `topic-checks*` exists in either dir — coverage is indirect via `review.spec.ts` / `card-to-note.spec.ts` / `create-note-with-checks.spec.ts`. Argument **for** a row: high churn, central to the recall loop, no direct test. Argument **against**: it's the same data behind R2 (scheduling) + R1 (isolation) — convergence, not a new failure mode.

**Recommendation framing for the planner:** the token HTTP API is the stronger candidate for an explicit §2 row OR an explicit "covered by R1 convergence + API input-validation" note — it currently appears in §2 only as an aside under R7 ("AI generation + token HTTP API covered-by-convergence"), which addresses XSS-convergence but **not** its IDOR/auth/input-validation profile. This is a §2 structural change that needs operator direction.

---

## Appendix — commands used

- `find src/__tests__ -name '*.test.ts' -o -name '*.test.tsx' | wc -l` → 39
- `find e2e -name '*.spec.ts' | wc -l` → 22
- `git log --since="30 days ago" --name-only --pretty=format:` aggregated by `src/features/<dir>` → churn table in §4.3.
- `grep -rn 'run-table-action\|runTableAction' src/__tests__/` → empty (no test).
- `grep -rniE 'MAX_PROMPT_CHARS|50_000|MAX_PDF|too large|100_000|over.?limit' src/__tests__/` → empty (no R4 ceiling test).
