'use server'

import { generateObject } from 'ai'
import { z } from 'zod'

import { generatedCardsSchema, type GeneratedCardT } from '@/features/openrouter/ai-schemas'
import {
  buildCardsPrompt,
  cardsMaterialFromNote,
  cardsMaterialFromTopic,
  promptOverrideSchema,
} from '@/features/openrouter/prompts'
import type { GenerateResultT } from '@/features/openrouter/types'
import { getOpenRouterModel } from '@/features/openrouter/server-client'
import { getNote } from '@/features/notes/queries'
import { logGeneration } from '@/lib/ai-debug/log-generation'
import { validateInput } from '@/lib/validate'

// gen-cards source: grounded on a saved note (#1) or ungrounded on a topic string (#2). Optional
// `modelId` overrides the settings default for this generation only (validated server-side).
// Optional `promptOverride`: the dialog's edited {system,prompt} — when present it REPLACES the built
// prompt (and the note fetch), so the user's refinement is exactly what's sent and logged (Phase 7).
const sourceSchema = z.union([
  z.object({
    noteId: z.guid('Invalid note id'),
    modelId: z.string().optional(),
    promptOverride: promptOverrideSchema.optional(),
  }),
  z.object({
    topic: z.string().trim().min(1, 'Enter a topic').max(200),
    modelId: z.string().optional(),
    promptOverride: promptOverrideSchema.optional(),
  }),
])

export async function generateCards(input: unknown): Promise<GenerateResultT<GeneratedCardT[]>> {
  const parsed = validateInput(sourceSchema, input)
  if (!parsed.success) return parsed
  const source = parsed.data

  // getOpenRouterModel decrypts the stored key, so it can throw on a tampered row or a rotated
  // OPENROUTER_ENC_KEY — keep it inside the try so that surfaces as a graceful error, not a 500.
  try {
    const bound = await getOpenRouterModel(source.modelId)
    if (!bound) return { success: false, error: 'Connect OpenRouter in Settings first.' }

    let system: string
    let prompt: string
    if (source.promptOverride) {
      // The edited prompt already carries the note material (the dialog seeded it from previewPrompt),
      // so we send it verbatim and skip the note fetch entirely.
      ;({ system, prompt } = source.promptOverride)
    } else {
      let material: string
      if ('noteId' in source) {
        const note = await getNote(source.noteId)
        if (!note) return { success: false, error: 'Note not found.' }
        material = cardsMaterialFromNote(note)
      } else {
        material = cardsMaterialFromTopic(source.topic)
      }
      ;({ system, prompt } = buildCardsPrompt(material))
    }
    const startedAt = Date.now()
    const { object, usage } = await generateObject({
      model: bound.model,
      schema: generatedCardsSchema,
      system,
      prompt,
    })
    await logGeneration({
      task: 'cards',
      model: bound.modelId,
      system,
      prompt,
      output: object,
      usage,
      latencyMs: Date.now() - startedAt,
    })
    return {
      success: true,
      data: object.cards,
      debug: { system, prompt, model: bound.modelId, usage },
    }
  } catch (error) {
    console.error('[generateCards] generation failed', error)
    return { success: false, error: 'AI generation failed. Try again.' }
  }
}
