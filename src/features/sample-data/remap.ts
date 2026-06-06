import type { SampleDataT } from '@/features/sample-data/types'
import type { TablesInsert } from '@/lib/supabase/types'

export type RemappedRowsT = {
  subjects: TablesInsert<'subjects'>[]
  notes: TablesInsert<'notes'>[]
  cards: TablesInsert<'memory_cards'>[]
}

// Pure transform: fixture → insert-ready rows. `idFor` MUST be memoized by the caller (same ref →
// same id) so a note's subjectRef and a card's noteRef resolve to their parent's assigned id.
// Cards get no id — nothing references them, so the DB default supplies one.
export function remapSampleData(
  fixture: SampleDataT,
  userId: string,
  idFor: (ref: string) => string,
): RemappedRowsT {
  const subjects = fixture.subjects.map((s) => ({
    id: idFor(s.ref),
    user_id: userId,
    title: s.title,
    description: s.description,
    is_seeded: true,
  }))

  const notes = fixture.notes.map((n) => ({
    id: idFor(n.ref),
    user_id: userId,
    subject_id: n.subjectRef ? idFor(n.subjectRef) : null,
    title: n.title,
    content: n.content,
    position: n.position,
    is_seeded: true,
  }))

  const cards = fixture.cards.map((c) => ({
    user_id: userId,
    note_id: idFor(c.noteRef),
    prompt: c.prompt,
    example: c.example,
    code_context: c.codeContext,
    is_seeded: true,
  }))

  return { subjects, notes, cards }
}
