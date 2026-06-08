import type { GeneratedCardT, GeneratedNoteT } from '@/features/openrouter/ai-schemas'

// Drop generated items whose required text fields are blank after trim, so one empty item the model
// emitted doesn't poison the whole batch (a blank card/note would otherwise reach the preview and
// save silently). The schema accepts `""` on purpose — emptiness is judged here at runtime, where
// the action can return a specific friendly error if nothing usable remains. Pure + unit-testable.

const isPresent = (value: string): boolean => value.trim().length > 0

export function keepCompleteCards(cards: GeneratedCardT[]): GeneratedCardT[] {
  return cards.filter((card) => isPresent(card.prompt) && isPresent(card.example))
}

export function keepCompleteNotes(notes: GeneratedNoteT[]): GeneratedNoteT[] {
  return notes.filter((note) => isPresent(note.title) && isPresent(note.content))
}
