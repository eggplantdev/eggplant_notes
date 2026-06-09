'use client'

import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormError } from '@/components/forms/hooks/use-form-error'
import { Button } from '@/components/ui/button'
import { updateDailyGoal } from '@/features/settings/actions/update-daily-goal'
import { dailyGoalFieldSchema } from '@/features/settings/schemas'

type DailyGoalFormPropsT = { dailyGoal: number }

// The field value is a string (the shared FormInput is string-typed); the action re-validates as a number server-side.
export function DailyGoalForm({ dailyGoal }: DailyGoalFormPropsT) {
  const { formError, clearError, reportResult } = useFormError()

  const form = useAppForm({
    defaultValues: { dailyGoal: String(dailyGoal) },
    onSubmit: async ({ value }) => {
      const result = await updateDailyGoal({ dailyGoal: Number(value.dailyGoal) })
      reportResult(result, { successMessage: 'Daily goal saved' })
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
