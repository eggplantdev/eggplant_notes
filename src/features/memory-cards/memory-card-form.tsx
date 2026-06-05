'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { CodeBlockInserter } from '@/components/markdown/code-block-inserter'
import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { toastActionResult } from '@/components/forms/toast-result'
import { MarkdownEditor } from '@/components/markdown/markdown-editor'
import { MarkdownPreview } from '@/components/markdown/markdown-preview'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createMemoryCard } from '@/features/memory-cards/actions/create-memory-card'
import { updateMemoryCard } from '@/features/memory-cards/actions/update-memory-card'
import { promptSchema } from '@/features/memory-cards/schemas'
import type { MemoryCardT } from '@/features/memory-cards/types'

// `check` present → edit (seeds defaults, calls updateMemoryCard); absent → create. Edit
// state is carried in the URL (`?edit=<id>`), so on a successful edit we navigate back to the
// bare note path to leave edit mode; on a successful create we reset for the next add and call
// `onClose` so the add-mode caller (AddMemoryCard) can collapse the form — which unmounts the
// CodeMirror island. The "Hide" button (add mode) calls the same `onClose` to dismiss without
// submitting. The server action revalidates the detail path, so the list refreshes either way.
// Only one CodeMirror island (code_context) ever mounts while the form is open.
type MemoryCardFormPropsT = {
  noteId: string
  check?: MemoryCardT
  onClose?: () => void
}

export function MemoryCardForm({ noteId, check, onClose }: MemoryCardFormPropsT) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | undefined>(undefined)

  const form = useAppForm({
    defaultValues: {
      prompt: check?.prompt ?? '',
      example: check?.example ?? '',
      code_context: check?.code_context ?? '',
    },
    onSubmit: async ({ value }) => {
      const result = check
        ? await updateMemoryCard(noteId, check.id, value)
        : await createMemoryCard(noteId, value)
      if (!toastActionResult(result, { successMessage: check ? 'Check saved' : 'Check added' })) {
        setFormError(result.error)
        return
      }
      if (check) {
        router.push(`/notes/${noteId}`)
      } else {
        form.reset()
        onClose?.()
      }
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
        <h3 className="font-medium">{check ? 'Edit memory card' : 'Add a memory card'}</h3>
        {!check && onClose && (
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Hide
          </Button>
        )}
      </div>

      <form.AppField name="prompt" validators={{ onBlur: promptSchema, onSubmit: promptSchema }}>
        {(field) => <field.Input label="Question" placeholder="What should you recall?" />}
      </form.AppField>

      <form.Field name="example">
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor="memory-card-example">Example (optional)</Label>
            <Textarea
              id="memory-card-example"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="A worked example or expected answer"
            />
          </div>
        )}
      </form.Field>

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

      <div className="flex items-center gap-2">
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : check ? 'Save changes' : 'Add memory card'}
            </Button>
          )}
        </form.Subscribe>
        {check && (
          <Button asChild variant="ghost">
            <Link href={`/notes/${noteId}`}>Cancel</Link>
          </Button>
        )}
      </div>
    </form>
  )
}
