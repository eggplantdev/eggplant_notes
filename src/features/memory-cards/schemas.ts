import { z } from 'zod'

import type { CardOverviewT } from '@/features/memory-cards/types'

// Runtime-validates the card_overview RPC's jsonb payload at the boundary (loud throw on a future
// SQL key change, not a silent `undefined`). `satisfies z.ZodType<CardOverviewT>` binds it to the
// hand type so the two can't drift.
export const cardOverviewSchema = z.object({
  byState: z.record(z.string(), z.number()),
  mature: z.number(),
  total: z.number(),
}) satisfies z.ZodType<CardOverviewT>

export const promptSchema = z
  .string()
  .trim()
  .min(1, 'Question is required')
  .max(2000, 'Question must be 2000 characters or fewer')

// Blank/whitespace-only → null (persist as SQL NULL, columns are nullable). Non-empty keeps its
// ORIGINAL text (no trim) so code indentation / leading newlines in `code_context` survive.
const optionalText = z.string().transform((v) => (v.trim().length > 0 ? v : null))

export const memoryCardInputSchema = z.object({
  prompt: promptSchema,
  example: optionalText,
  code_context: optionalText,
})

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
