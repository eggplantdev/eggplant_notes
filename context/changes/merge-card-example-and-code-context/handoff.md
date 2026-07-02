# Handoff — merge-card-example-and-code-context

**Status:** implementation COMPLETE + verified (typecheck + 290 unit tests + lint). DB migrated locally.
**NOT yet done:** E2E run, `slice-review-gate`, commit, archive. Prod migration (user applies by hand).
**Last updated:** 2026-06-29

## What this change does

Collapses `memory_cards.code_context` into `example` so a card has ONE markdown answer field. The split
was authoring-only (both columns rendered identically). New UX: one field that starts as a plain textarea
and upgrades to the markdown editor (CodeMirror) on demand via an "Add formatting" button.

## DB state (local) — CONSISTENT as of this handoff

- Migration `supabase/migrations/20260629120000_fold_code_context_into_example.sql` is **applied** and in
  the history. It: folds `code_context` into `example` (case-B `example\n\ncode_context`, case-A
  `example := code_context`), drops the column, and replaces `create_note_with_cards` to stop inserting it.
- Verified: `code_context` column gone, RPC has 0 `code_context` refs, 198 cards preserved (61 folded),
  `src/lib/supabase/types.ts` regenerated (0 `code_context`).
- The migration is **idempotent** (fold guarded on column existence) — safe to re-run.

### ⚠ Local-Supabase ownership quirk (important for re-applying)

`supabase migration up` FAILS here with `must be owner of table schema_migrations` (history table owned by
`supabase_admin`, CLI connects as `postgres`). Workaround used: apply the SQL directly as `supabase_admin`:

```
docker cp supabase/migrations/20260629120000_*.sql supabase_db_eggplant_notes:/tmp/mig.sql
docker exec supabase_db_eggplant_notes psql -U supabase_admin -d postgres -f /tmp/mig.sql
```

The `create or replace function` and the `schema_migrations` insert BOTH require the `supabase_admin` role
(objects are owned by it, not `postgres`).

### ⚠ Mid-session incident (resolved) — why the DB looked broken

During this work a **parallel agent session** wiped + restored the local `public` schema (a `db reset`-style
recovery; it committed 3 DB-recovery commits to `main`: `9ab0c08`, `1b142ea`, `82685d7`, plus a
`context/changes/db-recovery-backup/` folder). The restore reverted my migration's schema effect
(`code_context` came back) while LEAVING the history row — so the history lied "applied" and `migration up`
would have skipped it. Fixed by re-applying the SQL directly (above). **If the DB ever looks reverted
again, re-apply the migration directly; don't trust the history row alone.**

## Files changed (all uncommitted in working tree)

**New:**

- `supabase/migrations/20260629120000_fold_code_context_into_example.sql`
- `src/features/memory-cards/components/card-example-field.tsx` — the shared single-field component
  (textarea → "Add formatting" → `EditorWithPreview`; `useId` so `getByLabel('Example (optional)')` works).

**Four-surfaces contract (all moved in lockstep):**

- Schemas/types: `memory-cards/schemas.ts`, `memory-cards/types.ts`, `sample-data/types.ts`
  (GeneratedCardT in `openrouter/ai-schemas.ts` already had no `code_context` — no change needed).
- Data layer: `api/memory-cards/route.ts`, `api/notes/[id]/route.ts`, `memory-cards/queries.ts` (selects +
  `searchOr`). Core/insert modules spread input → auto-clean, no edits.
- Forms (3): `card-form.tsx`, `notes/components/memory-cards-field.tsx`, `memory-card-form.tsx` — all use
  `CardExampleField` now; dropped `code_context` field/state/imports.
- Render (3): `review-panel.tsx`, `memory-cards-section.tsx`, `note-memory-cards-list.tsx`.
- AI gen: `generate-cards-button.tsx` — removed the `code_context: ''` boundary remap (candidates now match
  the schema exactly).
- Contract docs: `eggplant-notes.skill.md` rewritten (field table, "fence your code", examples) THEN
  regenerated `src/features/api-tokens/skill-template.ts` via `gen-skill-template.mjs`. FAQ had no
  `code_context` refs — no change.
- Sample data: `sample-data/remap.ts`, `sample-data/sample-data.ts` (all 70 `codeContext` were null →
  removed), seed scripts `dump-sample-fixture.mjs` + `generate-section-seed.mjs`, and `supabase/seed.sql`
  (dev block: 1 code-only card folded into `example`; generated test@gmail.com block: column stripped).

**Tests updated:** `card-schema.test.ts` (rewrote the obsolete "code_context required" block → "candidate
shape validates directly"), `api-card-body.test.ts`, `api-routes.integration.test.ts`,
`update-cores.test.ts`, `sample-data-remap.test.ts`, `review-scheduling.test.ts`.
**E2E updated:** `e2e/memory-cards.spec.ts` (CRUD test now upgrades via `card-example-rich` testid + fenced
code in `example`; S-17 deferred test now expects the editor DOUBLY-deferred — behind "Add card" AND "Add
formatting"; isolation test folds into one `example`), `e2e/helpers.ts` + `e2e/create-note-with-checks.spec.ts`
(comments).

## Remaining TODO (in order)

1. **Run E2E** — `pnpm test:e2e` (needs local Supabase up; runs a fresh prod build on port 3100). Verify the
   3 updated specs, especially the `card-example-rich` "Add formatting" flow + Shiki render from `example`.
2. **`slice-review-gate`** — this change has its own change folder, so the gate is required.
3. **Commit** — stage ONLY my files by explicit path (NOT the parallel session's recovery files /
   `db-recovery-backup/`). Working tree also has unrelated `TODO.md` mods — leave them.
4. **Prod migration** — user applies `20260629120000` to hosted DB by hand (agent never pushes prod). Prod
   had 185 cards / 52 with `code_context` (per change.md count, 2026-06-26).
5. **Post-archive:** update `lessons.md` if a rule emerged (candidate: the local-Supabase `supabase_admin`
   ownership quirk for `migration up`; and the parallel-session DB-wipe hazard). No roadmap/Linear entry for
   this change (standalone — the change folder is its record).

## Integration tests note

`pnpm test:integration` can't run in this environment — fails at import with
`Cannot find package 'server-only'`. Pre-existing, unrelated to this change.
