'use client'

import { useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { Button } from '@/components/ui/button'
import { TitledCard } from '@/components/ui/titled-card'
import { updatePassword } from '@/features/auth/actions/update-password'
import { passwordSchema } from '@/features/auth/schemas'

export default function UpdatePasswordPage() {
  const [formError, setFormError] = useState<string | undefined>(undefined)

  const form = useAppForm({
    defaultValues: { password: '' },
    onSubmit: async ({ value }) => {
      const result = await updatePassword(value)
      // Success redirects (throws), so this branch only sees failure. The error shows inline via
      // <FormError> below — no toast, which would just repeat the visible message.
      if (!result.success) setFormError(result.error)
    },
  })

  return (
    <TitledCard
      variant="gradient"
      title="Set new password"
      description="Enter a new password for your account."
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          setFormError(undefined)
          form.handleSubmit()
        }}
      >
        <form.AppField
          name="password"
          validators={{ onBlur: passwordSchema, onSubmit: passwordSchema }}
        >
          {(field) => (
            <field.Input label="New password" type="password" autoComplete="new-password" />
          )}
        </form.AppField>
        <FormError message={formError} />
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save password'}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </TitledCard>
  )
}
