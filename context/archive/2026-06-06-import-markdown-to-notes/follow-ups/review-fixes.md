# Review follow-ups — import-markdown-to-notes

Deferred findings from the per-slice review gate (2026-06-07). Out of this slice's scope; tracked
here for a later change.

## F3 — Add an OAuth `state` CSRF parameter to the OpenRouter connect

- **Where:** `src/features/openrouter/actions/connect.ts`, `src/app/api/openrouter/callback/route.ts`
- **What:** The PKCE flow has no `state` param binding the callback to the session that started it.
  `SameSite=Lax` on the verifier cookie + the PKCE verifier already gate the exchange, so practical
  risk is low for a BYOK connect.
- **Why deferred:** OpenRouter's auth endpoint isn't confirmed to echo `state` back; adding an
  unverified param could break the live connect. Confirm against OpenRouter's live OAuth docs first,
  then add a random `state` cookie set alongside the verifier and rejected on mismatch in the callback.

## F5 — Hard-verify note ownership in card-creation actions

- **Where:** `src/features/memory-cards/actions/create-cards-for-note.ts` AND the pre-existing
  `src/features/memory-cards/actions/create-memory-card.ts` (same gap).
- **What:** Both fetch the note's `subject_id` via an RLS-scoped read but don't early-return when the
  note read is `null`, so a caller passing a foreign `noteId` still inserts their own card pointing at
  another user's `note_id` (the card is owned by the caller; the foreign note's content is never
  exposed). Low severity; the card row is RLS-owned by the caller.
- **Why deferred:** Cross-cutting — fix both sites together (the new action mirrors the inherited
  pattern). Add `if (!note) return { success: false, error: 'Note not found.' }` after the note read
  in both.

## AG-8 — Invert the `openrouter → notes` dependency if that edge grows

- **Where:** `src/features/openrouter/actions/preview-prompt.ts:10`, `actions/generate-cards.ts` (both
  import `getNote` from `features/notes/queries`).
- **What:** `openrouter` actions import `getNote` from `features/notes` — a cross-feature edge (public
  query surface, no cycle, mirrors the pre-existing `generateCards` pattern, so not a violation today).
- **Why deferred:** Clean for now. If `openrouter` grows more `features/notes` touchpoints, invert:
  have the caller (which already owns the note) pass `Pick<NoteT,'title'|'content'>` into
  `previewPrompt`/`generateCards` so `openrouter` depends only on the shared `NoteT` type, never on
  `features/notes`. `prompts.ts:cardsMaterialFromNote` is already shaped for this. (The action layer
  still re-fetches server-side for the RLS trust boundary — only the display-only `previewPrompt` can
  fully sever the edge.) Surfaced by the Phase 5 feature-first-structure review.

## Gate 2026-06-07 (Phase 7 #3 + Phase 8 — PDF/vision)

### G8-1 — File-filtered model picker is empty when the live catalog is offline/fails

- **Where:** `src/features/openrouter/components/model-select.tsx:28-33` (`RECOMMENDED_SEED`),
  `src/features/openrouter/catalog.ts` (`FALLBACK`).
- **What:** Both hardcode `inputModalities: ['text']` for every recommended model. With
  `filter='file'` (PDF surface), `filterModels` drops all of them — so before the live `/models`
  fetch lands the "Recommended" group is empty, and if the fetch _fails_ the file-filtered picker
  shows "No models found" permanently. Generation still works (the selected value defaults to
  `DEFAULT_OPENROUTER_FILE_MODEL`, which passes `isAllowedModel` via FALLBACK), but the user can't
  see or switch models. Degraded/offline-only; the happy path (live fetch) is fine.
- **Why deferred:** Fix is to tag the known file-capable recommended ids (Gemini Flash, GPT-4o,
  Claude 3.x) with a vision modality in the seed/fallback — but hardcoding modalities risks drifting
  from OpenRouter's truth. Low severity; revisit if offline PDF use matters.

### G8-2 — No Tailwind-aware ESLint plugin → unregistered classes invisible to CI

- **Where:** `eslint.config.mjs` (project-wide).
- **What:** No `eslint-plugin-better-tailwindcss`, so `pnpm lint` never flags an unregistered utility
  or legacy `[var(--x)]` syntax — those are editor-IntelliSense-only. Surfaced by the tailwind-v4
  audit (the slice itself was clean).
- **Why deferred:** Tooling change, project-wide, out of this slice's scope. Wire the plugin with
  `entryPoint` → `src/app/globals.css` as a standalone chore.
