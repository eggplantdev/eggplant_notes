# rename-checks-to-cards

**Status:** in progress
**Date:** 2026-06-26

## What

Rename the legacy "checks" vocabulary to "cards" across the entire create-note-with-memory-cards
path — app, public HTTP-API wire contract, AND the Postgres RPC — so every layer speaks one word.
"Checks" was the original name for what the product now everywhere calls a **memory card**.

## Why

The name `checks` was vague and inconsistent with the rest of the product (everything else says
"memory card" / "card"). Confirmed via prod query that there are **no real users** yet (only the
owner + admin + 2 abandoned unconfirmed sign-ups), so the breaking wire/DB rename carries no
migration-window or client-compat cost — the clean full rename is the right call now, before users
arrive.

## Scope

- **Schema/types** (`notes/schemas.ts`): `createNoteWithChecksSchema`→`createNoteWithCardsSchema`,
  `CreateNoteWithChecksT`→`CreateNoteWithCardsT`, `StagedCheckInputT`→`StagedCardInputT`, property
  `checks`→`cards`.
- **Write core**: `insert-note-with-checks.ts`→`insert-note-with-cards.ts` (`insertNoteWithChecks`→
  `insertNoteWithCards`).
- **Surfaces**: create-note Server Action, `POST /api/notes` route, the create-note form
  (`memory-cards-field.tsx`, `note-form.tsx`).
- **Public wire contract (BREAKING):** `POST /api/notes` body field `checks`→`cards`. Updated the
  downloadable-skill source (`eggplant-notes.skill.md`) and regenerated `skill-template.ts`.
- **Database**: migration `20260626154723_rename_create_note_with_checks_to_cards.sql` —
  `create_note_with_cards(p_note, p_cards)` (body identical to the prior definition) + drop the old
  `create_note_with_checks`. Regenerated `src/lib/supabase/types.ts`.
- **Tests**: `api-routes.integration.test.ts` (wire `cards`), `api-tokens.integration.test.ts`
  (direct RPC `create_note_with_cards`/`p_cards`).
- **Docs**: `run-rpc.ts` comment + `lessons.md` identifier mentions updated to the new name.
  Historical records (`roadmap.md ## Done`, the archived S-07 slice name) deliberately left as-is.

## Deliberately NOT done here

- Historical/immutable docs (archive folder name, roadmap build-log entries naming the S-07
  `create-note-with-checks` slice) — rewriting them would falsify the build history.

## Verification

- typecheck clean; migration applied locally via `migration up` (non-destructive — no `db reset`);
  function rename verified in local DB; types regenerated from live schema.
- Full suite + review gate: pending (this gate run).

## Prod follow-up (owner-applied)

- The migration must be applied to prod manually (agent is blocked from `db push`). Lowest-risk
  order: deploy code first, then apply the migration immediately — only note **creation** is affected
  during the gap, and there are no users.
