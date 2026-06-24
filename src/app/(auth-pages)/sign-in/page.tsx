'use client'

import Link from 'next/link'
import { useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { TitledCard } from '@/components/ui/titled-card'
import { signIn } from '@/features/auth/actions/sign-in'
import { emailSchema, passwordSchema } from '@/features/auth/schemas'

export default function SignInPage() {
  const [formError, setFormError] = useState<string | undefined>(undefined)

  const form = useAppForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      const result = await signIn(value)
      // Success redirects (throws), so this branch only sees failure. The error shows inline via
      // <FormError> below — no toast, which would just repeat the visible message.
      if (!result.success) setFormError(result.error)
    },
  })

  return (
    <TitledCard variant="gradient" title="Sign in" description="Welcome back.">
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
        <form.AppField
          name="password"
          validators={{ onBlur: passwordSchema, onSubmit: passwordSchema }}
        >
          {(field) => (
            <field.Input label="Password" type="password" autoComplete="current-password" />
          )}
        </form.AppField>
        <FormError message={formError} />
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" size="default" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Spinner /> Signing in…
                </>
              ) : (
                'Sign in'
              )}
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
    </TitledCard>
  )
}
