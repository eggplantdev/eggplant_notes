'use client'

import { useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { toastActionResult } from '@/components/forms/toast-result'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { subjectTitleSchema } from '@/features/subjects/schemas'
import type { SubjectInputT } from '@/features/subjects/schemas'
import type { SubjectT } from '@/types/subject'
import type { ActionResultT } from '@/types/action'

// `subject` present → edit (action needs the id); absent → create. Mirrors NoteForm's
// union prop so TS narrows the action signature off `subject`'s truthiness. On success the
// server action redirects (throws), so the form only ever sees the failure branch.
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

      <form.Field name="description">
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={field.name}>Description (optional)</Label>
            <Textarea
              id={field.name}
              name={field.name}
              placeholder="What this subject covers"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>

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
