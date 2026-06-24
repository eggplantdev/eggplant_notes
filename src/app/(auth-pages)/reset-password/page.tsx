'use client'

import Link from 'next/link'
import { useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { TitledCard } from '@/components/ui/titled-card'
import { resetPassword } from '@/features/auth/actions/reset-password'
import { emailSchema } from '@/features/auth/schemas'

export default function ResetPasswordPage() {
  const [formError, setFormError] = useState<string | undefined>(undefined)
  const [sent, setSent] = useState(false)

  const form = useAppForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      const result = await resetPassword(value)
      // Unlike the other auth flows, success doesn't redirect — it keeps the inline "check your email"
      // confirmation. The error shows inline via <FormError> — no toast repeating the visible message.
      if (!result.success) {
        setFormError(result.error)
        return
      }
      setSent(true)
    },
  })

  return (
    <TitledCard
      variant="gradient"
      title="Reset password"
      description="We'll email you a link to set a new password."
    >
      {sent ? (
        <p className="text-sm">
          If an account exists for that email, you&apos;ll receive a password-reset link shortly.
        </p>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setFormError(undefined)
            form.handleSubmit()
          }}
        >
          <form.AppField name="email" validators={{ onBlur: emailSchema, onSubmit: emailSchema }}>
            {(field) => <field.Input label="Email" type="email" autoComplete="email" />}
          </form.AppField>
          <FormError message={formError} />
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" size="default" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Spinner /> Sending…
                  </>
                ) : (
                  'Send reset link'
                )}
              </Button>
            )}
          </form.Subscribe>
        </form>
      )}
      <p className="text-muted-foreground mt-4 text-sm">
        <Link href="/sign-in" className="underline">
          Back to sign in
        </Link>
      </p>
    </TitledCard>
  )
}
