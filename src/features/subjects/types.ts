import type { NoteT } from '@/types/note'
import type { SubjectT } from '@/types/subject'

// Lightweight note shape for the subject docs-view sidebar nav: titles + ordering only, no
// `content`. Single source of truth for getSubjectNoteSummaries' return and the sidebar's props.
export type SubjectNoteSummaryT = Pick<NoteT, 'id' | 'title' | 'position'>

// The slim columns the /subjects list card renders, for getSubjectsList's paginated reads.
export type SubjectListItemT = Pick<SubjectT, 'id' | 'title' | 'description' | 'created_at'>
