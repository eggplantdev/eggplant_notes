'use server'

import { generateObject } from 'ai'
import { z } from 'zod'

import { generatedNotesSchema, type GeneratedNoteT } from '@/features/openrouter/ai-schemas'
import {
  buildNotesFilePrompt,
  buildNotesPrompt,
  promptOverrideSchema,
} from '@/features/openrouter/prompts'
import type { GenerateResultT } from '@/features/openrouter/types'
import { getOpenRouterModel } from '@/features/openrouter/server-client'
import { logGeneration } from '@/lib/ai-debug/log-generation'
import { validateInput } from '@/lib/validate'

// 10 MB decoded — a practical ceiling for a single-call vision read (base64 inflates ~4/3 over the wire).
const MAX_PDF_BYTES = 10 * 1024 * 1024
const MAX_PDF_BASE64_CHARS = Math.ceil(MAX_PDF_BYTES / 3) * 4

// gen-notes source: grounded decomposition of prose into MANY notes (#3), an ungrounded single note
// on a topic (#5), or a PDF read by a vision model (#PDF, Phase 8). Optional `modelId` overrides the
// settings default for this generation only. Optional `promptOverride`: the dialog's edited
// {system,prompt}, sent+logged verbatim when present (Phase 7). All return note candidates to the
// caller's preview — nothing is inserted.
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
  z.object({
    // The PDF, base64-encoded for the wire; decoded to a Buffer for the AI SDK file part.
    file: z.object({
      dataBase64: z
        .string()
        .min(1, 'Upload a PDF')
        .max(MAX_PDF_BASE64_CHARS, 'PDF is too large (max 10 MB).'),
      mediaType: z.literal('application/pdf'),
      filename: z.string().max(255).optional(),
    }),
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
      : 'file' in source
        ? buildNotesFilePrompt()
        : buildNotesPrompt('text' in source ? { text: source.text } : { topic: source.topic })
    const startedAt = Date.now()
    // PDF path attaches the file as a vision content part; text/topic send the prompt as-is. Both
    // extract the same notes schema and capture usage identically.
    const { object, usage } = await generateObject({
      model: bound.model,
      schema: generatedNotesSchema,
      system,
      ...('file' in source
        ? {
            messages: [
              {
                role: 'user' as const,
                content: [
                  { type: 'text' as const, text: prompt },
                  {
                    type: 'file' as const,
                    data: Buffer.from(source.file.dataBase64, 'base64'),
                    mediaType: source.file.mediaType,
                    filename: source.file.filename,
                  },
                ],
              },
            ],
          }
        : { prompt }),
    })
    // Scanned/empty/garbage input can yield zero notes without throwing — surface it instead of a
    // confusing empty preview.
    if (object.notes.length === 0) {
      return {
        success: false,
        error:
          "Couldn't extract any notes — if this is a scanned PDF, its text may not be readable.",
      }
    }
    // Best-effort, self-contained error handling — don't block the response on the log write.
    void logGeneration({
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
