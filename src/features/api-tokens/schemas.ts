import { z } from 'zod'

import { cardsArraySchema, noteIdSchema } from '@/features/memory-cards/schemas'
import { noteInputSchema } from '@/features/notes/schemas'
import { trimmedString } from '@/lib/schema-builders'

export const TOKEN_NAME_MAX_LENGTH = 60

// Two schemas for two layers (daily-goal precedent): `tokenNameFieldSchema` is the string field
// validator the mint form's TanStack field runs on blur/submit; `mintTokenSchema` is the action
// contract. Named distinctly from `noteAttachCardsSchema` below — both legitimately live here, but
// one validates the mint form, the other the note-attach route body.
export const tokenNameFieldSchema = trimmedString('Name', TOKEN_NAME_MAX_LENGTH)

export const mintTokenSchema = z.object({ name: tokenNameFieldSchema })

export type MintTokenInputT = z.infer<typeof mintTokenSchema>

// Body for POST /api/memory-cards when attaching cards to an existing note. The route selects this schema
// by the PRESENCE of `note_id` in the raw body (the standalone-card branch is `cardWithSubjectSchema`);
// it deliberately does NOT use a z.union, whose fall-through would silently re-route a note-attach body
// with a malformed `cards` array to the standalone branch instead of returning 400.
export const noteAttachCardsSchema = z.object({
  note_id: noteIdSchema,
  cards: cardsArraySchema,
})

// Body for PATCH /api/notes/:id: the editable note fields plus an OPTIONAL `unlink` list for a subject
// move. On a subject change every linked card follows the note by default; ids in `unlink` detach
// instead (note_id → null, keeping their old subject). There is deliberately NO per-card `move` list —
// the only fate the UI can't express is "stay linked but keep the old subject", which is exactly the
// invariant-violating state (a linked card must share its note's subject), so the API mustn't mint it.
// Card ids are DB-originated → validate SHAPE only with z.guid() (z.uuid() rejects non-RFC seed ids —
// see memory-cards/schemas.ts).
const cardActionIdSchema = z.guid('Invalid card id')

export const patchNoteBodySchema = noteInputSchema.extend({
  card_actions: z
    .object({
      unlink: z.array(cardActionIdSchema),
    })
    .optional(),
})

export type PatchNoteBodyT = z.infer<typeof patchNoteBodySchema>
