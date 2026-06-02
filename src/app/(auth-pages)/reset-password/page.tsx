'use client'

import Link from 'next/link'
import { useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { emailSchema } from '@/features/auth/schema'

import { resetPassword } from '@/features/auth/actions/reset-password'

export default function ResetPasswordPage() {
  const [formError, setFormError] = useState<string | undefined>(undefined)
  const [sent, setSent] = useState(false)

  const form = useAppForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      const result = await resetPassword(value)
      if (result.success) setSent(true)
      else setFormError(result.error)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>We&apos;ll email you a link to set a new password.</CardDescription>
      </CardHeader>
      <CardContent>
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
            <form.AppField name="email" validators={{ onChange: emailSchema }}>
              {(field) => <field.Input label="Email" type="email" autoComplete="email" />}
            </form.AppField>
            <FormError message={formError} />
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Sending…' : 'Send reset link'}
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
      </CardContent>
    </Card>
  )
}
