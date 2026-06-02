'use client'

import Link from 'next/link'
import { useState } from 'react'

import { FormError } from '@/shared/components/forms/form-components/form-error'
import { useAppForm } from '@/shared/components/forms/hooks/form-hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { credentialsSchema } from '@/features/auth/schema'

import { signUp } from '@/features/auth/actions/sign-up'

export default function SignUpPage() {
  const [formError, setFormError] = useState<string | undefined>(undefined)

  const form = useAppForm({
    defaultValues: { email: '', password: '' },
    validators: { onSubmit: credentialsSchema },
    onSubmit: async ({ value }) => {
      const result = await signUp(value)
      if (!result.success) setFormError(result.error)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Sign up with your email.</CardDescription>
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
          <form.AppField name="email">
            {(field) => <field.Input label="Email" type="email" autoComplete="email" />}
          </form.AppField>
          <form.AppField name="password">
            {(field) => (
              <field.Input label="Password" type="password" autoComplete="new-password" />
            )}
          </form.AppField>
          <FormError message={formError} />
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating account…' : 'Create account'}
              </Button>
            )}
          </form.Subscribe>
        </form>
        <p className="text-muted-foreground mt-4 text-sm">
          Already have an account?{' '}
          <Link href="/sign-in" className="underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
