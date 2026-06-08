import { z } from 'zod'

import type { NoteT } from '@/types/note'

// Single source for every AI prompt: the actions send these and `previewPrompt` displays these, so
// the shown prompt can never drift from the sent one. System prompts are static constants (kept
// constant for prompt-cache friendliness — S01E02); the dynamic material goes in the user message.
// This is the one file to edit when refining prompts.

export type PromptT = { system: string; prompt: string }

// The three system prompts a user can override (editable-system-prompts). MUST match the
// prompt_key CHECK constraint in the user_prompts migration. Single source: PromptKeyT and the
// userPromptSchema enum both derive from this array.
export const PROMPT_KEYS = ['cards', 'notes_decompose', 'notes_topic'] as const
export type PromptKeyT = (typeof PROMPT_KEYS)[number]

// Cap on a user-edited prompt. The auto-built prompt embeds the source text (notes decompose allows
// up to 50k chars) plus instructions, so the ceiling is generous — it only guards against pathological
// payloads, not normal refinement.
const MAX_PROMPT_CHARS = 100_000

// Validates the dialog's editable prompt before it reaches `generateObject` (Phase 7): both halves
// must be non-empty after trim and within the cap. `generateObject`'s Zod schema still constrains the
// OUTPUT regardless of how the input prompt is edited — this only sanity-checks the input blob.
export const promptOverrideSchema = z.object({
  system: z.string().trim().min(1, 'System prompt is empty').max(MAX_PROMPT_CHARS),
  prompt: z.string().trim().min(1, 'Prompt is empty').max(MAX_PROMPT_CHARS),
})

// Validates a Save-prompt mutation (editable-system-prompts): which prompt to override + the
// replacement system text. Only the system half is persisted — the user-message half stays a
// per-generation override (see generate-dialog). Reuses the generous MAX_PROMPT_CHARS cap.
export const userPromptSchema = z.object({
  promptKey: z.enum(PROMPT_KEYS),
  system: z.string().trim().min(1, 'Prompt is empty').max(MAX_PROMPT_CHARS),
})

// gen-cards #1 grounded source assembly. Note is already fetched (the IO stays in the caller); this
// keeps material assembly identical between the action and the preview.
export function cardsMaterialFromNote(note: Pick<NoteT, 'title' | 'content'>): string {
  return `Note title: ${note.title ?? 'Untitled'}\n\n${note.content}`
}

export function cardsMaterialFromTopic(topic: string): string {
  return `Topic: ${topic}`
}

const CARDS_SYSTEM = [
  'You generate spaced-repetition recall cards for a learner.',
  'Each card has a "prompt" (a question or cue) and an "example" (the answer or a worked example).',
  'Base every card ONLY on the material provided — never invent facts beyond it.',
  'Produce 3 to 7 focused cards; keep prompts answerable and examples concise.',
].join(' ')

export function buildCardsPrompt(material: string): PromptT {
  return {
    system: CARDS_SYSTEM,
    prompt: `Create recall cards from the following material.\n\n${material}`,
  }
}

// gen-notes: decompose prose into MANY notes (#3) vs a single note on a topic (#5).
const NOTES_DECOMPOSE_SYSTEM = [
  'You split source material into multiple focused study notes.',
  'Each note has a "title" and markdown "content".',
  'Identify the distinct topics and produce one note per topic — prefer several notes over one.',
  'Base every note ONLY on the provided text; do not invent material.',
].join(' ')

const NOTES_TOPIC_SYSTEM = [
  'You write a single focused study note on the given topic.',
  'The note has a "title" and clear, well-structured markdown "content".',
].join(' ')

// The built-in default per key — the fallback when a user has no override row (resolver returns
// these) and the equality target for the Save "delete-if-default" branch (isBuiltinSystem).
export const BUILTIN_SYSTEM: Record<PromptKeyT, string> = {
  cards: CARDS_SYSTEM,
  notes_decompose: NOTES_DECOMPOSE_SYSTEM,
  notes_topic: NOTES_TOPIC_SYSTEM,
}

// Drives the Save "delete-if-default" branch: saving the built-in text verbatim means "no override",
// so the action deletes the row instead of forking the user onto a frozen copy of the default.
// Trim both sides — the schema trims input, and the constants are already trim-clean.
export function isBuiltinSystem(promptKey: PromptKeyT, system: string): boolean {
  return system.trim() === BUILTIN_SYSTEM[promptKey]
}

// Pure reduce behind getResolvedSystemPrompts: overlay each saved row onto the built-in defaults.
// Unknown keys are ignored so a stray row can't widen the map. Kept pure (no DB) so it's unit-testable.
export function resolveSystemPrompts(
  rows: ReadonlyArray<{ prompt_key: string; system: string }>,
): Record<PromptKeyT, string> {
  const resolved = { ...BUILTIN_SYSTEM }
  for (const row of rows) {
    if (row.prompt_key in resolved) resolved[row.prompt_key as PromptKeyT] = row.system
  }
  return resolved
}

export function buildNotesPrompt(source: { text: string } | { topic: string }): PromptT {
  if ('text' in source) {
    return {
      system: NOTES_DECOMPOSE_SYSTEM,
      prompt: `Split the following material into notes.\n\n${source.text}`,
    }
  }
  return { system: NOTES_TOPIC_SYSTEM, prompt: `Write a study note about: ${source.topic}` }
}

// gen-notes from an uploaded file (#PDF, Phase 8): same decompose intent as the text path, but the
// source is attached as a file part on the user message — the instruction here is the text half.
export function buildNotesFilePrompt(): PromptT {
  return {
    system: NOTES_DECOMPOSE_SYSTEM,
    prompt: 'Read the attached document and split it into multiple focused study notes.',
  }
}

// What the generate dialog previews BEFORE generating — the exact prompt the matching action will
// send, built from the SAME builders so the two can't drift. Pure: the caller passes material it
// already has (the grounded-cards caller passes the note it already loaded), so there's no DB fetch
// and no LLM cost; the note fetch lives only in the action (its RLS trust boundary).
export type PreviewInputT =
  | { task: 'cards'; material: string }
  | { task: 'notes'; text: string }
  | { task: 'notes'; topic: string }
  | { task: 'notes'; file: true }

export function previewPrompt(input: PreviewInputT): PromptT {
  if (input.task === 'cards') return buildCardsPrompt(input.material)
  if ('file' in input) return buildNotesFilePrompt()
  return buildNotesPrompt('text' in input ? { text: input.text } : { topic: input.topic })
}

// Which overridable system prompt a generation surface uses — lets the dialog self-identify its
// prompt_key from the previewInput it already has (no extra prop). Mirrors previewPrompt's routing:
// cards → 'cards'; a topic note → 'notes_topic'; decompose (text or file) → 'notes_decompose'.
export function promptKeyFromPreviewInput(input: PreviewInputT): PromptKeyT {
  if (input.task === 'cards') return 'cards'
  if ('topic' in input) return 'notes_topic'
  return 'notes_decompose'
}
