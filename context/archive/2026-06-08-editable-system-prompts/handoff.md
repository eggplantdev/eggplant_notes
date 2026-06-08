# Handoff — editable-system-prompts

**As of 2026-06-08. Branch:** `feat/ai-authoring-iter2`. **Change folder:** `context/changes/editable-system-prompts/`.

## What this change does

Lets BYOK OpenRouter users edit the AI **System prompt** in the generate dialog and have it **persist
per user** (e.g. drop the hardcoded "3 to 7 cards" rule). Stored in a new `user_prompts` table; row
absent = built-in default. Two dialog buttons: **Save prompt** (upsert, or delete-if-equals-default) and
**Reset prompt** (AlertDialog confirm → delete row → built-in). Design + plan: `design.md`, `plan.md`,
`plan-brief.md`.

## Status: all 4 phases IMPLEMENTED + committed. Automated checks all green. Manual verification PENDING.

| Phase              | What                                                                                                                                                                  | Commit(s)            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1 Data layer       | `user_prompts` migration (composite PK, RLS incl. DELETE, moddatetime), resolver, key/schema helpers, neutralized the duplicate card-count `.describe()`, regen types | `17ff21e`            |
| 2 Actions + wiring | `saveUserPrompt` / `resetUserPrompt`; resolved-system overlay in `generate-cards`/`generate-notes` non-override branches                                              | `004d998`            |
| 3 Dialog           | `systemDefault`→map seed, Save + Reset(confirm) buttons, `savedSystem` baseline, unit tests; Reset **hidden until a saved override exists** (user decision)           | `ede188e`, `b5dd334` |
| 4 Threading        | resolve at the 4 page boundaries, thread `systemDefaults` map through every wrapper into each `GenerateDialog`                                                        | `0f05977`            |

Automated (current): `pnpm typecheck` clean · `pnpm exec eslint` 0 · `pnpm test` 176/176 ·
`pnpm build` succeeds. RLS verified via `pg_catalog`.

## What's LEFT (next session)

1. **Manual verification** (no UI existed until p4; deferred here). Items, all against the running app:
   - 2.4 custom row used by generation without in-dialog edit (check generation debug `system`)
   - 2.5 Save with built-in text deletes the row
   - 3.4 edit → Save → persists on reopen · 3.5 Reset → confirm → built-in · 3.6 Prompt half still one-shot
   - 4.5 cross-surface persistence (note A → note B) · 4.6 per-key independence · 4.7 generation honors
     saved prompt without re-edit · 4.8 Reset-confirm returns built-in everywhere
   - Browser flow may instead be driven by **/10x-e2e** per the project test plan.
   - These Progress rows are still `- [ ]` in `plan.md` (intentionally — surfaced at archive).
2. **Slice review gate** (user asked for "slice review"): run `slice-review-gate` →
   review → `/simplify` → tests → archive. **Caveat below before `/simplify`.**
3. **After archive:** this is a standalone change (no roadmap/Linear entry) — the archive is its record.

## ⚠ Active parallel session — READ BEFORE ANY git / `/simplify`

A second agent is actively working the **openrouter** feature in the SAME working tree (models refactor:
`credential.ts`, `credits.ts`, `utils/*-models.ts`, `constants.ts`, reformatting `generate-notes.ts`).
This already caused one near-miss: their `git commit` (no pathspec) swept my **staged** p3 files into
their commit (`9d35ad7`); they reverted it and I re-committed cleanly (`ede188e`). Rules that held:

- **Stage + commit ONLY this change's files, by explicit path.** Use `git commit -m "…" -- <paths>`
  (pathspec, `-m` BEFORE `--`) so even a contaminated shared index can't pull in their work.
- For the App-Router bracket path use `:(literal)src/app/(protected)/notes/[id]/page.tsx`.
- **Do NOT run `/simplify` while their work is dirty** (lesson: a mutating cleanup agent deleted a
  parallel file once). Confirm `git status` shows only this change's files first, or scope `/simplify` to
  committed paths and forbid deletions.
- Currently dirty (theirs, leave alone): `credential.ts`, `credits.ts`, `sort-models.ts`.

## Key files

- `src/features/openrouter/prompts.ts` — `PROMPT_KEYS`/`PromptKeyT`, `BUILTIN_SYSTEM`, `userPromptSchema`,
  `promptKeyFromPreviewInput`, `isBuiltinSystem`, `resolveSystemPrompts` (pure, unit-tested).
- `src/features/openrouter/queries.ts` — `getResolvedSystemPrompts` (override ?? built-in).
- `src/features/openrouter/actions/{save-user-prompt,reset-user-prompt,revalidate-prompt-surfaces}.ts`.
- `src/features/openrouter/components/generate-dialog.tsx` — `systemDefaults` map prop, Save/Reset.
- `src/__tests__/user-prompts.test.ts` — pure-logic specs (added to `stryker.config.json` mutate glob).
- `supabase/migrations/20260608200115_user_prompts.sql`.

## Notable decisions

- **Reset hidden until a saved override exists** (not always-visible-disabled). Trade-off: no one-click
  "discard unsaved typing" when on the default — the dialog reseeds on reopen instead.
- **Resolved system overlaid in two places that read the same table** (dialog seed = cosmetic; generate
  action = authoritative) → preview can't drift from what's sent.
- **Save delete-if-equals-default** so a user who saves the built-in verbatim stays attached to future
  default changes (no frozen fork).
- `.next-prodtest/` left from the isolated prod build (gitignored).
