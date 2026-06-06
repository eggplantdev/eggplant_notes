// `ref` values are synthetic stable keys for in-fixture parent linkage only — NOT DB ids; the loader
// assigns fresh ids at insert time. No user_id/timestamps/FSRS columns: loader injects user_id, DB
// defaults supply state=0 / due_at=now() (cards due now).

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
