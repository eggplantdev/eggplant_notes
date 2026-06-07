import type { NoteT } from '@/types/note'
import type { SubjectT } from '@/types/subject'

// Lightweight note shape for the sidebar nav: titles + ordering only, no `content`.
export type SubjectNoteSummaryT = Pick<NoteT, 'id' | 'title' | 'position'>

export type SubjectListItemT = Pick<SubjectT, 'id' | 'title' | 'description' | 'created_at'>

// Subject shape for picker `<select>`s + list-page filter options — id/title only. All consumers
// of getSubjects map straight to {value, label}, so `description`/`created_at` would be dead weight.
export type SubjectOptionT = Pick<SubjectT, 'id' | 'title'>
