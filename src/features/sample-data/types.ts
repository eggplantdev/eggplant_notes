// Shape of the committed sample-data fixture (src/features/sample-data/sample-data.ts) and the
// contract the loader/remap agree on. `ref` values are synthetic stable keys used ONLY for
// in-fixture parent linkage (notes → their subject, cards → their note); they are NOT DB ids —
// the loader assigns fresh ids at insert time. No user_id, timestamps, or FSRS columns live here:
// the loader injects user_id and the DB defaults supply state=0 / due_at=now() (cards due now).

export type SampleSubjectT = {
  ref: string
  title: string
  description: string | null
}

export type SampleNoteT = {
  ref: string
  subjectRef: string | null
  title: string
  content: string
  position: number
}

export type SampleCardT = {
  noteRef: string
  prompt: string
  example: string | null
  codeContext: string | null
}

export type SampleDataT = {
  subjects: SampleSubjectT[]
  notes: SampleNoteT[]
  cards: SampleCardT[]
}
