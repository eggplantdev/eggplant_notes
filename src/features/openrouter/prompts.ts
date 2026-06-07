import type { NoteT } from '@/types/note'

// Single source for every AI prompt: the actions send these and `previewPrompt` displays these, so
// the shown prompt can never drift from the sent one. System prompts are static constants (kept
// constant for prompt-cache friendliness — S01E02); the dynamic material goes in the user message.
// This is the one file to edit when refining prompts.

export type PromptT = { system: string; prompt: string }

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

export function buildNotesPrompt(source: { text: string } | { topic: string }): PromptT {
  if ('text' in source) {
    return {
      system: NOTES_DECOMPOSE_SYSTEM,
      prompt: `Split the following material into notes.\n\n${source.text}`,
    }
  }
  return { system: NOTES_TOPIC_SYSTEM, prompt: `Write a study note about: ${source.topic}` }
}

// What the generate dialog previews BEFORE generating — the exact prompt the matching action will
// send, built from the SAME builders so the two can't drift. Pure: the caller passes material it
// already has (the grounded-cards caller passes the note it already loaded), so there's no DB fetch
// and no LLM cost; the note fetch lives only in the action (its RLS trust boundary).
export type PreviewInputT =
  | { task: 'cards'; material: string }
  | { task: 'notes'; text: string }
  | { task: 'notes'; topic: string }

export function previewPrompt(input: PreviewInputT): PromptT {
  if (input.task === 'cards') return buildCardsPrompt(input.material)
  return buildNotesPrompt('text' in input ? { text: input.text } : { topic: input.topic })
}
