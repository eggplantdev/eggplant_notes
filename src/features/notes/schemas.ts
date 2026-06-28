import { z } from 'zod'

import { memoryCardInputSchema } from '@/features/memory-cards/schemas'
import { subjectTitleSchema } from '@/features/subjects/schemas'
import { trimmedString } from '@/lib/schema-builders'

// `title` is required at the app layer (the DB column is nullable); `content` may be empty (a
// title-only note is valid).
export const titleSchema = trimmedString('Title', 200)

export const contentSchema = z.string()

// `subject_id` optional: omitted (no assignment change), null ("None" picked), or a uuid.
// z.guid (shape only), not z.uuid (RFC version/variant) — opaque DB ids; see memory-cards/schemas.ts.
export const noteSubjectIdSchema = z.guid('Invalid subject id').nullable().optional()

export const noteInputSchema = z.object({
  title: titleSchema,
  content: contentSchema,
  subject_id: noteSubjectIdSchema,
})

export const noteIdSchema = z.guid('Invalid note id')

// Extends noteInput with subject_title for inline-create. Rejects subject_id + subject_title together — the RPC resolves one or the other.
export const createNoteInputSchema = noteInputSchema
  .extend({ subject_title: subjectTitleSchema.optional() })
  .refine((n) => !(n.subject_id && n.subject_title), {
    message: 'Pick an existing subject or name a new one, not both',
    path: ['subject_title'],
  })

// `cards` capped to bound the RPC's bulk insert.
export const createNoteWithCardsSchema = z.object({
  note: createNoteInputSchema,
  cards: z.array(memoryCardInputSchema).max(50, 'At most 50 memory cards per note'),
})

export type NoteInputT = z.infer<typeof noteInputSchema>
export type CreateNoteInputT = z.infer<typeof createNoteInputSchema>
export type CreateNoteWithCardsT = z.infer<typeof createNoteWithCardsSchema>
// Form-side (pre-transform) shape — z.input keeps it in sync with memoryCardInputSchema without drift.
export type StagedCardInputT = z.input<typeof memoryCardInputSchema>
