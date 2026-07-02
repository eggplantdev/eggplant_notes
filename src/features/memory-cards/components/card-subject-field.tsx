'use client'

import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import type { SubjectOptionT } from '@/features/subjects/types'

// Combobox needs a concrete option value; an unfiled card ↔ this sentinel ↔ null on the way out.
const NO_SUBJECT = 'none'

type CardSubjectFieldPropsT = {
  // The owning form field's name — ties the Label to the Combobox.
  id: string
  value: string | null
  onChange: (subjectId: string | null) => void
  subjects: SubjectOptionT[]
}

// The optional subject picker for a card. Owns the sentinel ↔ null mapping so the form only ever sees
// `string | null` (an unfiled card is null, never the "none" string).
export function CardSubjectField({ id, value, onChange, subjects }: CardSubjectFieldPropsT) {
  const options = [
    { value: NO_SUBJECT, label: 'None' },
    ...subjects.map((subject) => ({ value: subject.id, label: subject.title })),
  ]

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Subject (optional)</Label>
      <Combobox
        id={id}
        value={value ?? NO_SUBJECT}
        onChange={(next) => onChange(next === NO_SUBJECT ? null : next)}
        options={options}
        searchPlaceholder="Search subject…"
        emptyMessage="No subject found."
        className="w-full sm:w-72"
      />
    </div>
  )
}
