import { z } from 'zod'

import { MAX_IMPORT_NOTES } from '@/features/import/constants'
import { contentSchema, titleSchema } from '@/features/notes/schemas'
import { subjectTitleSchema } from '@/features/subjects/schemas'

// Commit into an existing subject (`id`) or a new one (`title`) — at least one is required. The RPC
// reuses `id` when present, else creates from `title`; a reused id the caller doesn't own is rejected
// by the notes_insert_own subject-ownership policy at the DB.
export const importSubjectSchema = z
  .object({
    id: z.guid('Invalid subject id').optional(),
    title: subjectTitleSchema.optional(),
  })
  .refine((s) => Boolean(s.id) || Boolean(s.title), {
    message: 'Pick an existing subject or name a new one',
  })

// Reuses notes' own title/content schemas — import and manual-create share one contract, can't drift.
export const importNoteSchema = z.object({
  title: titleSchema,
  content: contentSchema,
})

export const importNotesSchema = z.object({
  subject: importSubjectSchema,
  notes: z
    .array(importNoteSchema)
    .min(1, 'Import at least one note')
    .max(MAX_IMPORT_NOTES, `At most ${MAX_IMPORT_NOTES} notes per import`),
})

export type ImportNotesT = z.infer<typeof importNotesSchema>
