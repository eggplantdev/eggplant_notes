'use client'

import { useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormError } from '@/components/forms/hooks/use-form-error'
import { Button } from '@/components/ui/button'
import { mintApiToken } from '@/features/api-tokens/actions/mint-api-token'
import { TokenRevealDialog } from '@/features/api-tokens/components/token-reveal-dialog'
import { tokenNameFieldSchema } from '@/features/api-tokens/schemas'

// Name + create a token. On success the raw value is captured into state (the only place it ever
// lives) to drive the show-once reveal modal; on failure the error renders inline via useFormError.
export function MintTokenForm() {
  const { formError, clearError, reportResult } = useFormError()
  const [rawToken, setRawToken] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: { name: '' },
    onSubmit: async ({ value }) => {
      const result = await mintApiToken({ name: value.name })
      // Read rawToken before reportResult narrows the result to `{ success: true }`.
      if (result.success) {
        setRawToken(result.rawToken)
        form.reset()
      }
      reportResult(result, { successMessage: 'Token created' })
    },
  })

  return (
    <>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          clearError()
          form.handleSubmit()
        }}
      >
        <form.AppField
          name="name"
          validators={{ onBlur: tokenNameFieldSchema, onSubmit: tokenNameFieldSchema }}
        >
          {(field) => (
            <field.Input label="Token name" placeholder="e.g. my-laptop" testId="token-name" />
          )}
        </form.AppField>

        <FormError message={formError} />

        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button
              type="submit"
              disabled={isSubmitting}
              className="self-start"
              data-testid="token-mint-submit"
            >
              {isSubmitting ? 'Creating…' : 'Create token'}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <TokenRevealDialog rawToken={rawToken} onClose={() => setRawToken(null)} />
    </>
  )
}
