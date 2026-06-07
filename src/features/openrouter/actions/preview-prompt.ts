'use server'

import {
  buildCardsPrompt,
  buildNotesPrompt,
  cardsMaterialFromNote,
  cardsMaterialFromTopic,
  type PromptT,
} from '@/features/openrouter/prompts'
import { getNote } from '@/features/notes/queries'

// What the generate dialog shows BEFORE generating — the exact prompt the matching action will send,
// built from the SAME builders so the two can't drift. No LLM call, no token cost. Model-independent
// (the prompt is identical across models), so it takes no modelId.
export type PreviewInputT =
  | { task: 'cards'; noteId: string }
  | { task: 'cards'; topic: string }
  | { task: 'notes'; text: string }
  | { task: 'notes'; topic: string }

export async function previewPrompt(input: PreviewInputT): Promise<PromptT> {
  if (input.task === 'cards') {
    if ('noteId' in input) {
      const note = await getNote(input.noteId)
      return buildCardsPrompt(cardsMaterialFromNote(note ?? { title: 'Untitled', content: '' }))
    }
    return buildCardsPrompt(cardsMaterialFromTopic(input.topic))
  }
  return buildNotesPrompt('text' in input ? { text: input.text } : { topic: input.topic })
}
