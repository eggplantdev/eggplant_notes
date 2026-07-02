'use client'

import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormError } from '@/components/forms/hooks/use-form-error'
import { getFieldErrorText } from '@/components/forms/utils'
import { Box } from '@/components/ui/box'
import { Button } from '@/components/ui/button'
import { createMemoryCard } from '@/features/memory-cards/actions/create-memory-card'
import { CardExampleField } from '@/features/memory-cards/components/card-example-field'
import { CardPromptField } from '@/features/memory-cards/components/card-prompt-field'
import { promptSchema } from '@/features/memory-cards/schemas'

// In-note inline ADD form (create-only). No subject picker: the card is seeded with the note's
// subject server-side, changeable later on the edit page. A successful add resets and fires
// `onClose` so AddMemoryCard collapses the form, unmounting the CodeMirror island.
type MemoryCardFormPropsT = {
  noteId: string
  onClose?: () => void
}

export function MemoryCardForm({ noteId, onClose }: MemoryCardFormPropsT) {
  const { formError, clearError, reportResult } = useFormError()

  const form = useAppForm({
    defaultValues: {
      prompt: '',
      example: '',
    },
    onSubmit: async ({ value }) => {
      const result = await createMemoryCard(noteId, value)
      if (!reportResult(result, { successMessage: 'Card added' })) return
      form.reset()
      onClose?.()
    },
  })

  return (
    <Box
      as="form"
      id="memory-card-form"
      className="w-full"
      onSubmit={(e) => {
        e.preventDefault()
        clearError()
        form.handleSubmit()
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Add a memory card</h3>
        {onClose && (
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Hide
          </Button>
        )}
      </div>

      <form.Field name="prompt" validators={{ onBlur: promptSchema, onSubmit: promptSchema }}>
        {(field) => (
          <CardPromptField
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={getFieldErrorText(field.state.meta.errors)}
            placeholder="What should you recall?"
          />
        )}
      </form.Field>

      <form.Field name="example">
        {(field) => <CardExampleField value={field.state.value} onChange={field.handleChange} />}
      </form.Field>

      <FormError message={formError} />

      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Add memory card'}
          </Button>
        )}
      </form.Subscribe>
    </Box>
  )
}
