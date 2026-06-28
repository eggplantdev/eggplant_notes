'use client'

import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormError } from '@/components/forms/hooks/use-form-error'
import { useActionNavigation } from '@/hooks/use-action-navigation'
import { Button } from '@/components/ui/button'
import { subjectTitleSchema } from '@/features/subjects/schemas'
import type { SubjectInputT } from '@/features/subjects/schemas'
import type { SubjectT } from '@/types/subject'
import type { ActionResultT, RedirectResultT } from '@/types/action'

// `subject` present → edit (action takes the id); absent → create. The union prop lets TS narrow
// the action signature off `subject`'s truthiness. On success the form client-navigates: edit → back
// to this subject (client-known id); create → the new subject's server-born id via RedirectResultT.
type SubjectFormPropsT =
  | { action: (input: SubjectInputT) => Promise<RedirectResultT>; subject?: undefined }
  | { action: (id: string, input: SubjectInputT) => Promise<ActionResultT>; subject: SubjectT }

export function SubjectForm(props: SubjectFormPropsT) {
  const { subject } = props
  const { formError, clearError, reportResult } = useFormError()
  const { isNavigating, navigate } = useActionNavigation()

  const form = useAppForm({
    defaultValues: { title: subject?.title ?? '', description: subject?.description ?? '' },
    onSubmit: async ({ value }) => {
      if (props.subject) {
        const result = await props.action(props.subject.id, value)
        if (reportResult(result)) navigate(`/subjects/${props.subject.id}`, 'subject-saved')
        return
      }
      const result = await props.action(value)
      if (!result.success) {
        reportResult(result)
        return
      }
      navigate(result.redirectTo, 'subject-saved')
    },
  })

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        clearError()
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
        {(isSubmitting) => {
          const pending = isSubmitting || isNavigating
          return (
            <Button type="submit" disabled={pending} className="self-start">
              {pending ? 'Saving…' : subject ? 'Save changes' : 'Create subject'}
            </Button>
          )
        }}
      </form.Subscribe>
    </form>
  )
}
