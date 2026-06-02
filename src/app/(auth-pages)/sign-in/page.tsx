'use client'

import Link from 'next/link'
import { useState } from 'react'

import { FormError } from '@/shared/components/forms/form-components/form-error'
import { useAppForm } from '@/shared/components/forms/hooks/form-hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { credentialsSchema } from '@/features/auth/schema'

import { signIn } from '@/features/auth/actions/sign-in'

export default function SignInPage() {
  const [formError, setFormError] = useState<string | undefined>(undefined)

  const form = useAppForm({
    defaultValues: { email: '', password: '' },
    validators: { onSubmit: credentialsSchema },
    onSubmit: async ({ value }) => {
      const result = await signIn(value)
      if (!result.success) setFormError(result.error)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back.</CardDescription>
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
              <field.Input label="Password" type="password" autoComplete="current-password" />
            )}
          </form.AppField>
          <FormError message={formError} />
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            )}
          </form.Subscribe>
        </form>
        <div className="text-muted-foreground mt-4 flex justify-between text-sm">
          <Link href="/sign-up" className="underline">
            Create account
          </Link>
          <Link href="/reset-password" className="underline">
            Forgot password?
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
