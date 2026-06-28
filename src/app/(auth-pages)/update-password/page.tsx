'use client'

import { useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useActionNavigation } from '@/hooks/use-action-navigation'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { TitledCard } from '@/components/ui/titled-card'
import { updatePassword } from '@/features/auth/actions/update-password'
import { passwordSchema } from '@/features/auth/schemas'

export default function UpdatePasswordPage() {
  const [formError, setFormError] = useState<string | undefined>(undefined)
  // /dashboard is a client-known URL; navigate there on success (loader shows, button stays pending).
  const { isNavigating, navigate } = useActionNavigation()

  const form = useAppForm({
    defaultValues: { password: '' },
    onSubmit: async ({ value }) => {
      const result = await updatePassword(value)
      if (result.success) {
        navigate('/dashboard', 'password-updated')
        return
      }
      // The error shows inline via <FormError> below — no toast, which would repeat the visible message.
      setFormError(result.error)
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
          {(isSubmitting) => {
            const pending = isSubmitting || isNavigating
            return (
              <Button type="submit" size="default" disabled={pending}>
                {pending ? (
                  <>
                    <Spinner /> Saving…
                  </>
                ) : (
                  'Save password'
                )}
              </Button>
            )
          }}
        </form.Subscribe>
      </form>
    </TitledCard>
  )
}
