import { z } from 'zod'

// Per-field schemas, composed into the object schema reused for server-side parsing in the
// actions. `prompt` (the question) is required; `example` and `code_context` are optional
// (FR-012). Blank/whitespace-only optionals coerce to `null` so they persist as SQL NULL, not
// '' — the columns are nullable with no default. Non-empty optionals keep their ORIGINAL text
// (no trim) so code indentation/leading newlines in `code_context` survive intact.
export const promptSchema = z
  .string()
  .trim()
  .min(1, 'Question is required')
  .max(2000, 'Question must be 2000 characters or fewer')

const optionalText = z.string().transform((v) => (v.trim().length > 0 ? v : null))

export const topicCheckInputSchema = z.object({
  prompt: promptSchema,
  example: optionalText,
  code_context: optionalText,
})

// Validates the note this check is attached to (written as `note_id`) and a check's own id.
export const noteIdSchema = z.uuid('Invalid note id')
export const topicCheckIdSchema = z.uuid('Invalid topic check id')

export type TopicCheckInputT = z.infer<typeof topicCheckInputSchema>
