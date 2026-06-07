'use server'

import { generateObject } from 'ai'
import { z } from 'zod'

import { generatedNotesSchema, type GeneratedNoteT } from '@/features/openrouter/ai-schemas'
import { buildNotesPrompt, promptOverrideSchema } from '@/features/openrouter/prompts'
import type { GenerateResultT } from '@/features/openrouter/types'
import { getOpenRouterModel } from '@/features/openrouter/server-client'
import { logGeneration } from '@/lib/ai-debug/log-generation'
import { validateInput } from '@/lib/validate'

// gen-notes source: grounded decomposition of prose into MANY notes (#3), or an ungrounded single
// note on a topic (#5). Optional `modelId` overrides the settings default for this generation only.
// Optional `promptOverride`: the dialog's edited {system,prompt}, sent+logged verbatim when present
// (Phase 7). Both return note candidates to the caller's preview — nothing is inserted.
const sourceSchema = z.union([
  z.object({
    text: z.string().trim().min(1, 'Paste some text').max(50_000),
    modelId: z.string().optional(),
    promptOverride: promptOverrideSchema.optional(),
  }),
  z.object({
    topic: z.string().trim().min(1, 'Enter a topic').max(200),
    modelId: z.string().optional(),
    promptOverride: promptOverrideSchema.optional(),
  }),
])

export async function generateNotes(input: unknown): Promise<GenerateResultT<GeneratedNoteT[]>> {
  const parsed = validateInput(sourceSchema, input)
  if (!parsed.success) return parsed
  const source = parsed.data

  // getOpenRouterModel decrypts the stored key (can throw on a tampered row / rotated key) — keep it
  // inside the try so it surfaces as a graceful error, not a 500.
  try {
    const bound = await getOpenRouterModel(source.modelId)
    if (!bound) return { success: false, error: 'Connect OpenRouter in Settings first.' }

    // The edited prompt (when present) is sent verbatim; otherwise build it from the source.
    const { system, prompt } = source.promptOverride
      ? source.promptOverride
      : buildNotesPrompt('text' in source ? { text: source.text } : { topic: source.topic })
    const startedAt = Date.now()
    const { object, usage } = await generateObject({
      model: bound.model,
      schema: generatedNotesSchema,
      system,
      prompt,
    })
    await logGeneration({
      task: 'notes',
      model: bound.modelId,
      system,
      prompt,
      output: object,
      usage,
      latencyMs: Date.now() - startedAt,
    })
    return {
      success: true,
      data: object.notes,
      debug: { system, prompt, model: bound.modelId, usage },
    }
  } catch (error) {
    console.error('[generateNotes] generation failed', error)
    return { success: false, error: 'AI generation failed. Try again.' }
  }
}
