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
// These are opaque, server-trusted ids that arrive straight from the DB, so validate SHAPE only
// (z.guid), NOT RFC-4122 version/variant (z.uuid). Postgres `uuid` accepts any 128-bit value;
// z.uuid() rejects non-v4 ids (e.g. deterministic seed ids like `…-0000-0000-…`) and silently
// broke EVERY mutation. Existence/ownership is enforced downstream by RLS + the action re-fetch,
// not here — keep this as z.guid. (Same reasoning for the note/subject id schemas.)
export const noteIdSchema = z.guid('Invalid note id')
export const topicCheckIdSchema = z.guid('Invalid topic check id')

export type TopicCheckInputT = z.infer<typeof topicCheckInputSchema>
