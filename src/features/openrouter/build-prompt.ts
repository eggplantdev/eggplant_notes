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

// A note's title is a separate field; `content` is not supposed to repeat it. But not every writer
// can be trusted to honor that (a model that ignores the prompt, an API caller, a hand-edited row,
// legacy seed data) — so we defensively drop a leading markdown heading whose text equals the title
// before prepending our own `Note title:` line. Without this, such notes feed the title twice into the
// card-generation context and every generated card echoes it.
function stripDuplicateTitleHeading(title: string, content: string): string {
  const lines = content.split('\n')
  let i = 0
  while (i < lines.length && lines[i].trim() === '') i++ // skip leading blank lines
  const heading = lines[i]?.match(/^#{1,6}\s+(.*)$/)
  if (heading && heading[1].trim() === title.trim()) {
    return lines
      .slice(i + 1)
      .join('\n')
      .trim()
  }
  return content
}

export function cardsMaterialFromNote(note: Pick<NoteT, 'title' | 'content'>): string {
  const title = note.title ?? 'Untitled'
  return `Note title: ${title}\n\n${stripDuplicateTitleHeading(title, note.content)}`
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
