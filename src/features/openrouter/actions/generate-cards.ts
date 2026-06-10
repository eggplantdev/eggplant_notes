'use server'

import { generateObject } from 'ai'
import { z } from 'zod'

import { generatedCardsSchema, type GeneratedCardT } from '@/features/openrouter/ai-schemas'
import {
  buildCardsPrompt,
  cardsMaterialFromNote,
  cardsMaterialFromTopic,
} from '@/features/openrouter/build-prompt'
import { promptOverrideSchema } from '@/features/openrouter/prompt-schemas'
import type { GenerateResultT } from '@/features/openrouter/types'
import { getResolvedSystemPrompts } from '@/features/openrouter/queries'
import { GENERATION_TIMEOUT_MS } from '@/features/openrouter/constants'
import { getOpenRouterModel } from '@/features/openrouter/server-client'
import { describeGenerationError } from '@/features/openrouter/utils/describe-generation-error'
import { keepCompleteCards } from '@/features/openrouter/utils/sanitize-generated'
import { getNote } from '@/features/notes/queries'
import { logGeneration } from '@/lib/ai-debug/log-generation'
import { validateInput } from '@/lib/validate'

// gen-cards source: grounded on a saved note or ungrounded on a topic string. Optional `modelId`
// overrides the settings default for this generation only (validated server-side). Optional
// `promptOverride`: the dialog's edited {system,prompt} — when present it REPLACES the built prompt
// (and the note fetch), so the user's refinement is exactly what's sent and logged.
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
  // Ungrounded on the note the user is CURRENTLY writing (create-note form) — no saved row to fetch,
  // so the material is built from the draft title+content the client sends (capped like notes text).
  z.object({
    draftNote: z.object({
      title: z.string().max(200),
      content: z.string().trim().min(1, 'Add note content first').max(50_000),
    }),
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
      } else if ('draftNote' in source) {
        material = cardsMaterialFromNote(source.draftNote)
      } else {
        material = cardsMaterialFromTopic(source.topic)
      }
      // The user-message half comes from the builder; the system half is the user's RESOLVED prompt
      // (their override or the built-in) — so an unedited generation still honors a saved prompt and
      // matches what the dialog previewed.
      prompt = buildCardsPrompt(material).prompt
      system = (await getResolvedSystemPrompts())['cards']
    }
    const startedAt = Date.now()
    const { object, usage } = await generateObject({
      model: bound.model,
      schema: generatedCardsSchema,
      system,
      prompt,
      abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    })
    // Drop blank-field cards before they reach the preview; an all-blank/empty result is surfaced as
    // a friendly error instead of a silent success that no-ops on Apply (mirrors the notes guard).
    const cards = keepCompleteCards(object.cards)
    const droppedCount = object.cards.length - cards.length
    // Best-effort, self-contained error handling — don't block the response on the log write.
    void logGeneration({
      task: 'cards',
      model: bound.modelId,
      system,
      prompt,
      output: object,
      usage,
      latencyMs: Date.now() - startedAt,
      droppedCount,
    })
    if (cards.length === 0) {
      return {
        success: false,
        error: "Couldn't generate any usable cards — try a more detailed note or topic.",
      }
    }
    return {
      success: true,
      data: cards,
      debug: { system, prompt, model: bound.modelId, usage },
    }
  } catch (error) {
    console.error('[generateCards] generation failed', error)
    return { success: false, error: describeGenerationError(error) }
  }
}
