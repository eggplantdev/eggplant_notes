'use client'

import { useState } from 'react'

import { CodeBlockInserter } from '@/components/markdown/code-block-inserter'
import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { toastActionResult } from '@/components/forms/toast-result'
import { MarkdownEditor } from '@/components/markdown/markdown-editor'
import { MarkdownPreview } from '@/components/markdown/markdown-preview'
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
  const [formError, setFormError] = useState<string | undefined>(undefined)

  const form = useAppForm({
    defaultValues: {
      prompt: '',
      example: '',
      code_context: '',
    },
    onSubmit: async ({ value }) => {
      const result = await createMemoryCard(noteId, value)
      if (!toastActionResult(result, { successMessage: 'Card added' })) {
        setFormError(result.error)
        return
      }
      form.reset()
      onClose?.()
    },
  })

  return (
    <form
      id="memory-card-form"
      className="flex flex-col gap-4 rounded-lg border p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setFormError(undefined)
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
    </form>
  )
}
