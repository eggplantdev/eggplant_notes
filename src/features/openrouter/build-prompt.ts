import type { NoteT } from '@/types/note'
import type { PromptT } from '@/features/openrouter/types'
import {
  CARDS_SYSTEM,
  NOTES_DECOMPOSE_SYSTEM,
  NOTES_TOPIC_SYSTEM,
} from '@/features/openrouter/system-prompts'

// What the generate actions SEND. previewPrompt (preview-prompt.ts) routes to these SAME builders so
// the shown prompt can never drift from the sent one. Pure — the caller passes material it already
// has (the grounded-cards caller passes the note it already loaded), so there's no DB fetch here.

export function cardsMaterialFromNote(note: Pick<NoteT, 'title' | 'content'>): string {
  return `Note title: ${note.title ?? 'Untitled'}\n\n${note.content}`
}

export function cardsMaterialFromTopic(topic: string): string {
  return `Topic: ${topic}`
}

export function buildCardsPrompt(material: string): PromptT {
  return {
    system: CARDS_SYSTEM,
    prompt: `Create recall cards from the following material.\n\n${material}`,
  }
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
