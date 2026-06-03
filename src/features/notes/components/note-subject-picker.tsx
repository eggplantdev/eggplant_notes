'use client'

import { useMemo, useState, useTransition } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { assignNoteSubject } from '@/features/notes/actions/assign-subject'
import type { SubjectT } from '@/types/subject'

// "None" sentinel — the Combobox needs a concrete option value, so an unassigned note maps to
// this and back to null on the way out. Mirrors the note-form picker.
const NO_SUBJECT = 'none'

type NoteSubjectPickerPropsT = {
  noteId: string
  currentSubjectId: string | null
  subjects: SubjectT[]
}

// Inline subject assignment on the note detail view. Saves immediately on select via the focused
// assignNoteSubject action (no title/content needed, no redirect). Optimistic local value keeps
// the trigger label in sync while the transition runs; a failure rolls it back and shows inline.
export function NoteSubjectPicker({ noteId, currentSubjectId, subjects }: NoteSubjectPickerPropsT) {
  const [value, setValue] = useState(currentSubjectId ?? NO_SUBJECT)
  const [error, setError] = useState<string | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  const options = useMemo(
    () => [
      { value: NO_SUBJECT, label: 'None' },
      ...subjects.map((subject) => ({ value: subject.id, label: subject.title })),
    ],
    [subjects],
  )

  function handleChange(next: string) {
    const previous = value
    setValue(next)
    setError(undefined)
    startTransition(async () => {
      const result = await assignNoteSubject(noteId, next === NO_SUBJECT ? null : next)
      if (!result.success) {
        setValue(previous)
        setError(result.error)
      }
    })
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor="note-subject">Subject</Label>
      <Combobox
        id="note-subject"
        value={value}
        onChange={handleChange}
        options={options}
        searchPlaceholder="Search subject…"
        emptyMessage="No subject found."
        className="w-full sm:w-72"
        disabled={isPending}
      />
      <FormError message={error} />
    </div>
  )
}
