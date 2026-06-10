'use client'

import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { SegmentedToggle } from '@/components/ui/segmented-toggle'
import type { SubjectOptionT } from '@/features/subjects/types'

// A note/card's subject choice: pick an EXISTING subject (or "None" when allowed) or name a NEW one
// to be created on save. The two modes are mutually exclusive — the consumer resolves this into either
// a subject_id or a subject_title for its action. Shared by the create-note form and the import flow.
export type SubjectChoiceT =
  | { mode: 'existing'; subjectId: string | null }
  | { mode: 'new'; title: string }

// Combobox needs a concrete option value; "None" ↔ this sentinel ↔ null subjectId. Exported so the
// note form's edit-mode Combobox (which doesn't use SubjectSelect) shares the one sentinel.
export const NO_SUBJECT = 'none'

// Matched to the create-note title Input (h-8); overridable via className.
const COMBOBOX_CLASS = 'h-8 w-full rounded-lg text-base font-normal sm:w-72 md:text-sm'

export function SubjectSelect({
  subjects,
  value,
  onChange,
  allowNone = false,
  testIdPrefix,
  className,
}: {
  subjects: SubjectOptionT[]
  value: SubjectChoiceT
  onChange: (value: SubjectChoiceT) => void
  // When true the existing-mode combobox offers a "None" option (unassigned) — notes allow it; the
  // import flow does not (it always commits under a subject).
  allowNone?: boolean
  testIdPrefix: string
  className?: string
}) {
  const existingOptions = [
    ...(allowNone ? [{ value: NO_SUBJECT, label: 'None' }] : []),
    ...subjects.map((s) => ({ value: s.id, label: s.title })),
  ]

  return (
    <div className="flex flex-col gap-2">
      <SegmentedToggle<SubjectChoiceT['mode']>
        size="sm"
        ariaLabel="Subject mode"
        value={value.mode}
        onChange={(mode) =>
          // Switching modes resets to that mode's empty state — existing starts unpicked (null = None
          // when allowed, or "must pick" for import); new starts with an empty title.
          onChange(
            mode === 'new' ? { mode: 'new', title: '' } : { mode: 'existing', subjectId: null },
          )
        }
        options={[
          { value: 'new', label: 'New subject', testId: `${testIdPrefix}-new-mode` },
          {
            value: 'existing',
            label: 'Existing subject',
            testId: `${testIdPrefix}-existing-mode`,
            // Nothing to pick if there are no subjects AND "None" isn't on offer.
            disabled: subjects.length === 0 && !allowNone,
          },
        ]}
      />
      {value.mode === 'new' ? (
        <Input
          data-testid={`${testIdPrefix}-title`}
          value={value.title}
          onChange={(e) => onChange({ mode: 'new', title: e.target.value })}
          placeholder="New subject name"
          className="sm:w-72"
        />
      ) : (
        <Combobox
          value={value.subjectId ?? (allowNone ? NO_SUBJECT : undefined)}
          onChange={(v) => onChange({ mode: 'existing', subjectId: v === NO_SUBJECT ? null : v })}
          options={existingOptions}
          searchPlaceholder="Search subject…"
          emptyMessage="No subject found."
          className={className ?? COMBOBOX_CLASS}
        />
      )}
    </div>
  )
}
