'use client'

import Link from 'next/link'
import { useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { Button } from '@/components/ui/button'
import { TitledCard } from '@/components/ui/titled-card'
import { signUp } from '@/features/auth/actions/sign-up'
import { emailSchema, passwordSchema } from '@/features/auth/schemas'
import { EMAIL_USER } from '@/lib/env'

// mailto (not the auth-gated Contact action) because the user is logged out here — a pre-login report
// has no session to attach. Targets the public sender address; EMAIL_TO is server-only, unreachable from
// this client bundle.
const REPORT_MAILTO = `mailto:${EMAIL_USER}?subject=${encodeURIComponent(
  'Sign-up problem report',
)}&body=${encodeURIComponent('Describe what went wrong:\n\n')}`

export default function SignUpPage() {
  const [formError, setFormError] = useState<string | undefined>(undefined)

  const form = useAppForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      const result = await signUp(value)
      // Success redirects (throws), so this branch only sees failure. The error shows inline via
      // <FormError> below — no toast, which would just repeat the visible message.
      if (!result.success) setFormError(result.error)
    },
  })

  return (
    <TitledCard variant="gradient" title="Create account" description="Sign up with your email.">
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
          {(field) => <field.Input label="Password" type="password" autoComplete="new-password" />}
        </form.AppField>
        <FormError message={formError} />
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" size="default" disabled={isSubmitting}>
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
      <p className="text-muted-foreground mt-2 text-sm">
        Having trouble?{' '}
        <a href={REPORT_MAILTO} className="underline">
          Report a problem
        </a>
      </p>
    </TitledCard>
  )
}
