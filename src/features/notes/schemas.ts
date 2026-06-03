import { z } from 'zod'

import { topicCheckInputSchema } from '@/features/topic-checks/schemas'

// Per-field schemas, passed to each field's `validators` (Standard Schema). The object
// schema below composes them and is reused for server-side parsing in the actions.
// `title` is required at the app layer (the DB column is nullable); `content` may be
// empty (the editor can save a title-only note).
export const titleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Title must be 200 characters or fewer')

export const contentSchema = z.string()

// `subject_id` is optional: omitted by callers that don't touch assignment, `null` when
// the form's subject picker selects "None", or a uuid when assigned. The note's
// `position` is derived from this in the actions, never sent by the client.
export const noteSubjectIdSchema = z.uuid('Invalid subject id').nullable().optional()

export const noteInputSchema = z.object({
  title: titleSchema,
  content: contentSchema,
  subject_id: noteSubjectIdSchema,
})

// Validates the `id` route param / form value for update + delete actions.
export const noteIdSchema = z.uuid('Invalid note id')

// S-07: note + its staged checks in one atomic write. Reuses topic-check's own input schema
// (topic-checks owns that contract — same feature→feature edge as review/dashboard, not a
// promotion candidate). `checks` is capped to bound the RPC's bulk insert.
export const createNoteWithChecksSchema = z.object({
  note: noteInputSchema,
  checks: z.array(topicCheckInputSchema).max(50, 'At most 50 topic checks per note'),
})

export type NoteInputT = z.infer<typeof noteInputSchema>
export type CreateNoteWithChecksT = z.infer<typeof createNoteWithChecksSchema>
// The pre-transform (form-side) shape of one staged check — all strings, before `optionalText`
// coerces blanks to null. Derived from the schema so it can never drift from the write-contract.
export type StagedCheckInputT = z.input<typeof topicCheckInputSchema>
