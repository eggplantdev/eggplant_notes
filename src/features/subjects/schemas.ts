import { z } from 'zod'

import { trimmedString } from '@/lib/schema-builders'

// description is normalized to undefined when blank so the DB stores null, not an empty string.
export const subjectTitleSchema = trimmedString('Title', 200)

export const subjectDescriptionSchema = z
  .string()
  .trim()
  .max(2000, 'Description must be 2000 characters or fewer')
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))

export const subjectInputSchema = z.object({
  title: subjectTitleSchema,
  description: subjectDescriptionSchema,
})

// Validates the `id` route param / form value for update + delete actions.
// z.guid (shape only), not z.uuid (RFC version/variant) — opaque DB id; see memory-cards/schemas.ts.
export const subjectIdSchema = z.guid('Invalid subject id')

export type SubjectInputT = z.infer<typeof subjectInputSchema>
