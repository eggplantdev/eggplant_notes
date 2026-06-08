import type { PromptKeyT } from '@/features/openrouter/constants'
import type { PromptT } from '@/features/openrouter/types'
import {
  buildCardsPrompt,
  buildNotesFilePrompt,
  buildNotesPrompt,
} from '@/features/openrouter/build-prompt'

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
