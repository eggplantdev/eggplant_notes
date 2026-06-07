'use server'

import { generateObject } from 'ai'
import { z } from 'zod'

import { generatedCardsSchema, type GeneratedCardT } from '@/features/openrouter/ai-schemas'
import { getOpenRouterModel } from '@/features/openrouter/server-client'
import { getNote } from '@/features/notes/queries'
import { validateInput } from '@/lib/validate'

export type GenerateResultT<T> = { success: true; data: T } | { success: false; error: string }

// gen-cards source: grounded on a saved note (#1) or ungrounded on a topic string (#2).
const sourceSchema = z.union([
  z.object({ noteId: z.guid('Invalid note id') }),
  z.object({ topic: z.string().trim().min(1, 'Enter a topic').max(200) }),
])

// Static system prompt (kept constant for prompt-cache friendliness — S01E02); the dynamic material
// goes in the user message. Cards are preview-gated by the caller — nothing is inserted here.
const SYSTEM = [
  'You generate spaced-repetition recall cards for a learner.',
  'Each card has a "prompt" (a question or cue) and an "example" (the answer or a worked example).',
  'Base every card ONLY on the material provided — never invent facts beyond it.',
  'Produce 3 to 7 focused cards; keep prompts answerable and examples concise.',
].join(' ')

export async function generateCards(input: unknown): Promise<GenerateResultT<GeneratedCardT[]>> {
  const parsed = validateInput(sourceSchema, input)
  if (!parsed.success) return parsed
  const source = parsed.data

  const model = await getOpenRouterModel()
  if (!model) return { success: false, error: 'Connect OpenRouter in Settings first.' }

  let material: string
  if ('noteId' in source) {
    const note = await getNote(source.noteId)
    if (!note) return { success: false, error: 'Note not found.' }
    material = `Note title: ${note.title ?? 'Untitled'}\n\n${note.content}`
  } else {
    material = `Topic: ${source.topic}`
  }

  try {
    const { object } = await generateObject({
      model,
      schema: generatedCardsSchema,
      system: SYSTEM,
      prompt: `Create recall cards from the following material.\n\n${material}`,
    })
    return { success: true, data: object.cards }
  } catch (error) {
    console.error('[generateCards] generateObject failed', error)
    return { success: false, error: 'AI generation failed. Try again.' }
  }
}
