import { z } from 'zod'

import { memoryCardInputSchema } from '@/features/memory-cards/schemas'

// `title` is required at the app layer (the DB column is nullable); `content` may be empty (a
// title-only note is valid).
export const titleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Title must be 200 characters or fewer')

export const contentSchema = z.string()

// `subject_id` optional: omitted (no assignment change), null ("None" picked), or a uuid.
// z.guid (shape only), not z.uuid (RFC version/variant) — opaque DB ids; see memory-cards/schemas.ts.
export const noteSubjectIdSchema = z.guid('Invalid subject id').nullable().optional()

export const noteInputSchema = z.object({
  title: titleSchema,
  content: contentSchema,
  subject_id: noteSubjectIdSchema,
})

// Validates the `id` route param / form value for update + delete actions.
export const noteIdSchema = z.guid('Invalid note id')

// Reuses memory-card's own input schema (memory-cards owns that contract). `checks` is capped to
// bound the RPC's bulk insert.
export const createNoteWithChecksSchema = z.object({
  note: noteInputSchema,
  checks: z.array(memoryCardInputSchema).max(50, 'At most 50 memory cards per note'),
})

export type NoteInputT = z.infer<typeof noteInputSchema>
export type CreateNoteWithChecksT = z.infer<typeof createNoteWithChecksSchema>
// The pre-transform (form-side) shape of one staged check — all strings, before `optionalText`
// coerces blanks to null. Derived from the schema so it can never drift from the write-contract.
export type StagedCheckInputT = z.input<typeof memoryCardInputSchema>
