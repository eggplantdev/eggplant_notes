import type { NoteT } from '@/types/note'
import type { SubjectT } from '@/types/subject'

// Lightweight note shape for the sidebar nav: titles + ordering only, no `content`.
export type SubjectNoteSummaryT = Pick<NoteT, 'id' | 'title' | 'position'>

export type SubjectListItemT = Pick<SubjectT, 'id' | 'title' | 'description' | 'created_at'>
