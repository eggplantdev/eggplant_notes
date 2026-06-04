import type { NoteT } from '@/types/note'

// Lightweight note shape for the subject docs-view sidebar nav: titles + ordering only, no
// `content`. Single source of truth for getSubjectNoteSummaries' return and the sidebar's props.
export type SubjectNoteSummaryT = Pick<NoteT, 'id' | 'title' | 'position'>
