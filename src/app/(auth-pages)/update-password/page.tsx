'use client'

import { useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { updatePasswordSchema } from '@/features/auth/schema'

import { updatePassword } from '@/features/auth/actions/update-password'

export default function UpdatePasswordPage() {
  const [formError, setFormError] = useState<string | undefined>(undefined)

  const form = useAppForm({
    defaultValues: { password: '' },
    validators: { onSubmit: updatePasswordSchema },
    onSubmit: async ({ value }) => {
      const result = await updatePassword(value)
      if (!result.success) setFormError(result.error)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set new password</CardTitle>
        <CardDescription>Enter a new password for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setFormError(undefined)
            form.handleSubmit()
          }}
        >
          <form.AppField name="password">
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
      </CardContent>
    </Card>
  )
}
