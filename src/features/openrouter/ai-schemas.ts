import { z } from 'zod'

// Structured-output schemas for the AI primitives (gen-cards, gen-notes). All fields are required
// (plain z.string()) — the AI SDK strict-output gotcha (use .nullable() not .optional()) only bites
// optional fields, and these always carry a value.

// gen-cards: a recall card is a prompt (cue) + example (the answer — what review-panel's "Show
// answer" reveals).
export const generatedCardSchema = z.object({
  prompt: z.string(),
  example: z.string(),
})
export const generatedCardsSchema = z.object({
  cards: z.array(generatedCardSchema),
})

// gen-notes: a note is a title + markdown content.
export const generatedNoteSchema = z.object({
  title: z.string(),
  content: z.string(),
})
export const generatedNotesSchema = z.object({
  notes: z.array(generatedNoteSchema),
})

export type GeneratedCardT = z.infer<typeof generatedCardSchema>
export type GeneratedNoteT = z.infer<typeof generatedNoteSchema>
