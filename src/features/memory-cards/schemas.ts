import { z } from 'zod'

import type { CardOverviewT } from '@/features/memory-cards/types'
import { trimmedString } from '@/lib/schema-builders'

// Runtime-validates the card_overview RPC's jsonb payload at the boundary (loud throw on a future
// SQL key change, not a silent `undefined`). `satisfies z.ZodType<CardOverviewT>` binds it to the
// hand type so the two can't drift.
export const cardOverviewSchema = z.object({
  byState: z.record(z.string(), z.number()),
  mature: z.number(),
  total: z.number(),
}) satisfies z.ZodType<CardOverviewT>

// A recall cue under ~10 chars is never a real question — enforce a floor. Shared by every
// card-create surface (forms + token API), so the manual forms reflect it in the UI automatically and
// the API rejects a too-short prompt. NB: independent of the generation dialog's
// MIN_GENERATION_PROMPT_CHARS — that floors the LLM *prompt textarea* (a different string); the
// shared `10` is coincidence, so don't fold them into one constant.
export const promptSchema = trimmedString('Question', 2000, 10)

// Blank/whitespace-only → null (persist as SQL NULL, the column is nullable). Non-empty keeps its
// ORIGINAL text (no trim) so code indentation / leading newlines in a fenced block survive. The KEY
// is required (a present value must be a string; `null`/omitted → 400) — callers carry it as `''`
// when absent. Matches GeneratedCardT ({prompt, example}) exactly, so AI gen-cards saves with no
// boundary remap.
const optionalText = z.string().transform((v) => (v.trim().length > 0 ? v : null))

export const memoryCardInputSchema = z.object({
  prompt: promptSchema,
  example: optionalText,
})

// Bulk card payload, capped to bound the insert. Shared by createCardsForNote (form action) and the
// note-attach branch of POST /api/memory-cards so the cap lives in one place.
export const cardsArraySchema = z.array(memoryCardInputSchema).min(1).max(20)

// Card fields plus the card's OWN subject. `subject_id` is nullable (a card may be unfiled) and
// validated SHAPE-only with z.guid() (see the id schemas below) — RLS owns existence/ownership.
export const cardWithSubjectSchema = memoryCardInputSchema.extend({
  subject_id: z.guid('Invalid subject id').nullable(),
})

// Validate SHAPE only (z.guid), NOT RFC-4122 version/variant (z.uuid): Postgres `uuid` accepts any
// 128-bit value, but z.uuid() rejects non-v4 ids like deterministic seed ids (`…-0000-0000-…`).
// Existence/ownership is enforced downstream by RLS + the action re-fetch.
export const noteIdSchema = z.guid('Invalid note id')
export const memoryCardIdSchema = z.guid('Invalid memory card id')

export type MemoryCardInputT = z.infer<typeof memoryCardInputSchema>
export type CardWithSubjectInputT = z.infer<typeof cardWithSubjectSchema>
