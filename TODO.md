# Coding Learning Companion — Backlog (operator triage)

> Markdown notes grouped into subjects + spaced-repetition recall cards. Eggplant-branded.
> **Deadline 2026-06-10 · today 2026-06-04 (~6 days slack).**
>
> **Status: the product WORKS.** North Star (recall loop) + every v1-usable slice + both fast-follow slices are shipped. All roadmap slices **S-01..S-10 done**. Only unstarted roadmap item is **S-11** (perf, status `proposed`).
> This backlog is **post-deadline-subset polish + new features — NOT critical-path work.**

---

## Cluster 1 — Branding / identity ("eggplant_notes")

_App currently has no name/logo/footer._

- [ ] Rename app to `eggplant_notes` — replace placeholder app title across UI/metadata.
- [ ] Eggplant logo — brand mark for nav/landing/favicon.
- [ ] Branded loader (bouncing eggplant) — replace remaining loaders/spinners.
- [ ] Footer (copyright etc.).

## Cluster 4 — Performance (= roadmap S-11, already scoped)

- [ ] Caching between route navigations / revalidate strategy. **Real blocker:** Next 16 `'use cache'` can't read cookies, but RLS scopes rows by the auth cookie — must resolve per-user cache keying first. A `staleTimes` stopgap was tried and reverted (no targeted invalidation).
- [x] Stop over-fetching: select only needed columns. Notes list was already slimmed (commit `8878f6d`, never selects `content`); audit found `getSubjects()` still selected `*` for id/title-only consumers — narrowed to `select('id, title')` (2026-06-07). Audit: `context/changes/query-performance-audit/audit.md`. Remaining items (un-indexed search `ILIKE`, fetch-all stats reads) are informational/scale-only — see audit F3–F5.

## Cluster 6 — Later (explicitly deferred)

- [ ] User account page ("konto usera — na później").
- [ ] **Connect an external LLM via OpenRouter (BYOK, PKCE)** — do this **LAST**. Largest new surface: external dependency, credential storage, new auth flow.

## Cluster 7 — Code health (dedup / simplification)

- [ ] Work the remaining items in `@SIMPLIFICATION-PROPOSALS.md` (repo root). Section A (`CardActions`, `useDeleteDialogState`, `EmptyState`, `MutedText`) is shipped; next quick-wins: **D1** toast-layer split, **B3** `useFormSubmit`, **C1** `runTableSingleQuery`, **D2** split `heatmap-view.ts`. See the doc's top **Handoff** block for state + decisions.
- [ ] **Split `src/features/openrouter/prompts.ts`** — grab-bag flagged by both `feature-first-structure` + `module-cohesion-audit` at the `editable-system-prompts` review gate (2026-06-08). Mixes 4 concerns: persistence Zod schemas, system-prompt constants + `resolveSystemPrompts`, pure prompt builders, preview-routing helpers. Split into `prompt-schemas.ts` / `system-prompts.ts` / `build-prompt.ts` / `preview-prompt.ts`, keeping `PROMPT_KEYS`/`PromptKeyT` as the shared const→type source. Deferred from the slice: behavior-neutral, touches cross-feature import sites (memory-cards/notes/import), and the parallel openrouter session was live — do it once that work settles.
- [ ] **Behavioral coverage for `editable-system-prompts`** (deferred at the 2026-06-08 review gate; unit logic is covered by `user-prompts.test.ts`, the rest isn't). The DB read (`getResolvedSystemPrompts`), both Save/Reset actions, and the dialog wiring have zero behavioral tests — `plan.md` Progress rows 2.4–2.5, 3.4–3.6, 4.5–4.8 stayed `[ ]` by design. Drive via `/10x-e2e`: save → cross-surface reopen → generate-honors-saved-prompt → reset-confirm → built-in; plus the programmatic two-client RLS isolation check.
- [ ] **Verify/fix `revalidate-prompt-surfaces.ts`** (review-gate altitude proposal, 2026-06-08) — it `revalidatePath`s four pages that are always-dynamic (`cookies()`), so it may be a no-op. Confirm (Save prompt → navigate to a 2nd surface → new baseline shows with the helper removed) → delete it, or switch to a `revalidateTag('user-prompts')` on the data. Also noted: `systemDefaults` is prop-drilled through 6 wrappers but each dialog reads one key — thin to a string or resolve at the leaf.

---

## Suggested sequencing

1. **Seed / dogfood now** (Cluster 5, already in progress)
2. **Branding** (Cluster 1)
3. **UI polish** (Cluster 2)
4. **Dashboard features** (Cluster 3)
5. **Performance** (Cluster 4 / S-11)
6. **LLM connect** (Cluster 6) — last

**Rationale:** polish + real data is what makes the operator actually keep using the app and is low-risk, so it goes first. S-11 has a genuine architectural blocker (per-user cache keying vs RLS cookie) so it gets its own focused change later. The LLM connect is the biggest/newest surface — last.

check on mobile

create notes out of markdown file or any file
create notes by asking ai

edit note view must have same editor like subject notes listing

update note by agent via webhook?

Adding notes instruction

Na kiedyś

# Settings

Settings model pickder
Allow setting default models
Sort by price
Sort alphabeticall
