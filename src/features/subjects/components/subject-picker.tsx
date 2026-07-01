'use client'

import { useRouter } from 'next/navigation'

import { Combobox } from '@/components/ui/combobox'
import type { SubjectPickerOptionT } from '@/features/subjects/types'

type SubjectPickerPropsT = { subjects: SubjectPickerOptionT[] }

// Landing selector for /subjects: no current subject and no forced redirect — picking one navigates
// straight to its first note (or the bare subject when it has none), skipping the /subjects/[id]
// redirect hop. Action-style (no bound `value`) so re-picking the subject you just left still navigates.
export function SubjectPicker({ subjects }: SubjectPickerPropsT) {
  const router = useRouter()

  return (
    <Combobox
      options={subjects.map((subject) => ({ value: subject.id, label: subject.title }))}
      onChange={(id) => {
        const subject = subjects.find((option) => option.id === id)
        router.push(
          subject?.firstNoteId ? `/subjects/${id}/${subject.firstNoteId}` : `/subjects/${id}`,
        )
      }}
      placeholder="Select a subject…"
      searchPlaceholder="Search subjects…"
      emptyMessage="No subjects."
      className="w-full max-w-72"
    />
  )
}
