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

// S-07: combined payload for creating a note together with its staged topic checks in one
// atomic write. Composes topic-check's own schema (cross-feature import at the 1st consumer —
// kept here rather than promoting topicCheckInputSchema to a shared tier, which the project's
// promotion rule reserves for the 2nd consumer; flagged for the review gate to confirm).
export const createNoteWithChecksSchema = z.object({
  note: noteInputSchema,
  checks: z.array(topicCheckInputSchema),
})

export type NoteInputT = z.infer<typeof noteInputSchema>
export type CreateNoteWithChecksT = z.infer<typeof createNoteWithChecksSchema>
