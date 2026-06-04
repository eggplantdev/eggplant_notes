'use client'

import { useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { toastActionResult } from '@/components/forms/toast-result'
import { Button } from '@/components/ui/button'
import { updateDailyGoal } from '@/features/settings/actions/update-daily-goal'
import { dailyGoalFieldSchema } from '@/features/settings/schemas'

type DailyGoalFormPropsT = { dailyGoal: number }

// Small numeric form to view/update the daily review goal. The field value is a string (the
// shared FormInput is string-typed); dailyGoalFieldSchema validates + bounds it on blur/submit
// and the action re-validates server-side. No redirect — toastActionResult drives the inline
// success/error toast, mirroring SubjectForm.
export function DailyGoalForm({ dailyGoal }: DailyGoalFormPropsT) {
  const [formError, setFormError] = useState<string | undefined>(undefined)

  const form = useAppForm({
    defaultValues: { dailyGoal: String(dailyGoal) },
    onSubmit: async ({ value }) => {
      const result = await updateDailyGoal({ dailyGoal: Number(value.dailyGoal) })
      if (!toastActionResult(result, { successMessage: 'Daily goal saved' })) {
        setFormError(result.error)
      }
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
        name="dailyGoal"
        validators={{ onBlur: dailyGoalFieldSchema, onSubmit: dailyGoalFieldSchema }}
      >
        {(field) => (
          <field.Input label="Daily goal (cards / day)" type="number" placeholder="e.g. 5" />
        )}
      </form.AppField>

      <FormError message={formError} />

      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting} className="self-start">
            {isSubmitting ? 'Saving…' : 'Save goal'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  )
}
