import { z } from 'zod'

// Subject = a grouping above notes. Title required at the app layer (DB column is
// not null anyway); description is optional and normalized to undefined when blank
// so the DB stores null rather than an empty string.
export const subjectTitleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Title must be 200 characters or fewer')

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
// z.guid (shape only), not z.uuid (RFC version/variant) — opaque DB id; see topic-checks/schemas.ts.
export const subjectIdSchema = z.guid('Invalid subject id')

export type SubjectInputT = z.infer<typeof subjectInputSchema>
