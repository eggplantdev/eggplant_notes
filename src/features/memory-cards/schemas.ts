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

export const memoryCardInputSchema = z.object({
  prompt: promptSchema,
  example: optionalText,
  code_context: optionalText,
})

// The standalone create + unified edit form's payload: the card fields plus the card's OWN
// subject. `subject_id` is optional (a card may be unfiled) and validated SHAPE-only with
// z.guid() per the id lesson — RLS owns existence/ownership. The in-note add form still uses the
// subject-less memoryCardInputSchema (it seeds the subject from the note server-side).
export const cardWithSubjectSchema = memoryCardInputSchema.extend({
  subject_id: z.guid('Invalid subject id').nullable(),
})

// Validates the note this card is attached to (written as `note_id`) and a card's own id.
// These are opaque, server-trusted ids that arrive straight from the DB, so validate SHAPE only
// (z.guid), NOT RFC-4122 version/variant (z.uuid). Postgres `uuid` accepts any 128-bit value;
// z.uuid() rejects non-v4 ids (e.g. deterministic seed ids like `…-0000-0000-…`) and silently
// broke EVERY mutation. Existence/ownership is enforced downstream by RLS + the action re-fetch,
// not here — keep this as z.guid. (Same reasoning for the note/subject id schemas.)
export const noteIdSchema = z.guid('Invalid note id')
export const memoryCardIdSchema = z.guid('Invalid memory card id')

export type MemoryCardInputT = z.infer<typeof memoryCardInputSchema>
export type CardWithSubjectInputT = z.infer<typeof cardWithSubjectSchema>
