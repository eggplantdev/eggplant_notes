'use server'

import { generateObject } from 'ai'
import { z } from 'zod'

import { generatedNotesSchema, type GeneratedNoteT } from '@/features/openrouter/ai-schemas'
import { type GenerateResultT } from '@/features/openrouter/actions/generate-cards'
import { getOpenRouterModel } from '@/features/openrouter/server-client'
import { validateInput } from '@/lib/validate'

// gen-notes source: grounded decomposition of prose into MANY notes (#3), or an ungrounded single
// note on a topic (#5). Both return note candidates to the caller's preview — nothing is inserted.
const sourceSchema = z.union([
  z.object({ text: z.string().trim().min(1, 'Paste some text').max(50_000) }),
  z.object({ topic: z.string().trim().min(1, 'Enter a topic').max(200) }),
])

// Decomposition's whole value is producing MULTIPLE notes from one source (a single note → just
// create one); the topic mode writes one focused note. Static system prompts (prompt-cache friendly).
const SYSTEM_DECOMPOSE = [
  'You split source material into multiple focused study notes.',
  'Each note has a "title" and markdown "content".',
  'Identify the distinct topics and produce one note per topic — prefer several notes over one.',
  'Base every note ONLY on the provided text; do not invent material.',
].join(' ')

const SYSTEM_TOPIC = [
  'You write a single focused study note on the given topic.',
  'The note has a "title" and clear, well-structured markdown "content".',
].join(' ')

export async function generateNotes(input: unknown): Promise<GenerateResultT<GeneratedNoteT[]>> {
  const parsed = validateInput(sourceSchema, input)
  if (!parsed.success) return parsed
  const source = parsed.data

  const model = await getOpenRouterModel()
  if (!model) return { success: false, error: 'Connect OpenRouter in Settings first.' }

  const decompose = 'text' in source
  try {
    const { object } = await generateObject({
      model,
      schema: generatedNotesSchema,
      system: decompose ? SYSTEM_DECOMPOSE : SYSTEM_TOPIC,
      prompt: decompose
        ? `Split the following material into notes.\n\n${source.text}`
        : `Write a study note about: ${source.topic}`,
    })
    return { success: true, data: object.notes }
  } catch (error) {
    console.error('[generateNotes] generateObject failed', error)
    return { success: false, error: 'AI generation failed. Try again.' }
  }
}
