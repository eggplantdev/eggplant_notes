'use client'

import { useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { toastActionResult } from '@/components/forms/toast-result'
import { Button } from '@/components/ui/button'
import { subjectTitleSchema } from '@/features/subjects/schemas'
import type { SubjectInputT } from '@/features/subjects/schemas'
import type { SubjectT } from '@/types/subject'
import type { ActionResultT } from '@/types/action'

// `subject` present → edit (action takes the id); absent → create. The union prop lets TS narrow
// the action signature off `subject`'s truthiness. On success the action redirects (throws), so
// the form only ever sees the failure branch.
type SubjectFormPropsT =
  | { action: (input: SubjectInputT) => Promise<ActionResultT>; subject?: undefined }
  | { action: (id: string, input: SubjectInputT) => Promise<ActionResultT>; subject: SubjectT }

export function SubjectForm(props: SubjectFormPropsT) {
  const { subject } = props
  const [formError, setFormError] = useState<string | undefined>(undefined)

  const form = useAppForm({
    defaultValues: { title: subject?.title ?? '', description: subject?.description ?? '' },
    onSubmit: async ({ value }) => {
      const result = props.subject
        ? await props.action(props.subject.id, value)
        : await props.action(value)
      // Error toasts here; success redirects → confirmed via the Phase-4 ?toast flag.
      if (!toastActionResult(result)) setFormError(result.error)
    },
  })

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setFormError(undefined)
        form.handleSubmit()
      }}
    >
      <form.AppField
        name="title"
        validators={{ onBlur: subjectTitleSchema, onSubmit: subjectTitleSchema }}
      >
        {(field) => (
          <field.Input label="Title" placeholder="e.g. Python — functional programming" />
        )}
      </form.AppField>

      <form.AppField name="description">
        {(field) => (
          <field.Textarea label="Description (optional)" placeholder="What this subject covers" />
        )}
      </form.AppField>

      <FormError message={formError} />

      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting} className="self-start">
            {isSubmitting ? 'Saving…' : subject ? 'Save changes' : 'Create subject'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  )
}
