import { z } from 'zod'

// Structured-output schemas for the AI primitives (gen-cards, gen-notes). All fields are required
// (plain z.string()) — the AI SDK strict-output gotcha (use .nullable() not .optional()) only bites
// optional fields, and these always carry a value.
//
// `.describe()` text is sent to the model as the field/array contract — it STEERS generation (the
// other steering is the system prompt). Emptiness and per-item completeness are NOT enforced here:
// no `.min`/length bounds and no `z.array().min(1)`. A schema-level min would make `generateObject`
// throw a generic `NoObjectGeneratedError` on an empty result, which collapses to a generic catch
// message — so the ≥1 invariant and blank-field drop are enforced at RUNTIME in the actions
// (`utils/sanitize-generated.ts` + the empty-guard), where a specific friendly error survives.

// gen-cards: a recall card is a prompt (cue) + example (the answer — what review-panel's "Show
// answer" reveals).
export const generatedCardSchema = z.object({
  prompt: z
    .string()
    .describe('The recall cue — a clear, self-contained question to prompt recall.'),
  example: z
    .string()
    .describe('The answer to the cue: a concise explanation or worked example revealed on review.'),
})
export const generatedCardsSchema = z.object({
  cards: z.array(generatedCardSchema).describe('3 to 7 recall cards covering the key ideas.'),
})

// gen-notes: a note is a title + markdown content.
export const generatedNoteSchema = z.object({
  title: z.string().describe('A short, descriptive title for the note.'),
  content: z.string().describe('The note body in Markdown, covering one distinct topic.'),
})
export const generatedNotesSchema = z.object({
  notes: z
    .array(generatedNoteSchema)
    .describe('One note per distinct topic found in the source material.'),
})

export type GeneratedCardT = z.infer<typeof generatedCardSchema>
export type GeneratedNoteT = z.infer<typeof generatedNoteSchema>
