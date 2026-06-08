'use client'

import { CodeBlockInserter } from '@/components/markdown/code-block-inserter'
import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormError } from '@/components/forms/hooks/use-form-error'
import { MarkdownEditor } from '@/components/markdown/markdown-editor'
import { MarkdownPreview } from '@/components/markdown/markdown-preview'
import { Box } from '@/components/ui/box'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { createMemoryCard } from '@/features/memory-cards/actions/create-memory-card'
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
      code_context: '',
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

      <form.AppField name="prompt" validators={{ onBlur: promptSchema, onSubmit: promptSchema }}>
        {(field) => <field.Input label="Question" placeholder="What should you recall?" />}
      </form.AppField>

      <form.AppField name="example">
        {(field) => (
          <field.Textarea
            label="Example (optional)"
            placeholder="A worked example or expected answer"
          />
        )}
      </form.AppField>

      <form.Field name="code_context">
        {(field) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Code context (optional)</Label>
              <CodeBlockInserter value={field.state.value} onChange={field.handleChange} />
            </div>
            <MarkdownEditor value={field.state.value} onChange={field.handleChange} />
            {field.state.value.trim().length > 0 && (
              <div className="prose dark:prose-invert max-w-none rounded-lg border p-4">
                <MarkdownPreview content={field.state.value} />
              </div>
            )}
          </div>
        )}
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
