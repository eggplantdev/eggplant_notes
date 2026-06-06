'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { CodeBlockInserter } from '@/components/markdown/code-block-inserter'
import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { toastActionResult } from '@/components/forms/toast-result'
import { MarkdownEditor } from '@/components/markdown/markdown-editor'
import { MarkdownPreview } from '@/components/markdown/markdown-preview'
import { Button } from '@/components/ui/button'
import { ButtonLink } from '@/components/ui/button-link'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createStandaloneCard } from '@/features/memory-cards/actions/create-standalone-card'
import { unlinkCardFromNote } from '@/features/memory-cards/actions/unlink-card-from-note'
import { updateMemoryCard } from '@/features/memory-cards/actions/update-memory-card'
import { promptSchema } from '@/features/memory-cards/schemas'
import type { MemoryCardT } from '@/features/memory-cards/types'
import { useActionTransition } from '@/hooks/use-action-transition'
import type { SubjectT } from '@/types/subject'

// "None" sentinel for the subject Combobox: an unfiled card maps to this constant for the picker
// and back to null on the way out (the Combobox needs a concrete option value). Mirrors note-form.
const NO_SUBJECT = 'none'

// The unified ROUTE form for /memory-cards/new (standalone create) and /memory-cards/[id]/edit
// (edit any card). Sibling to the in-note `memory-card-form.tsx` (which stays the subject-less
// inline ADD form) — kept separate per the plan so each stays thin. `card` present → edit (seeds
// defaults, calls updateMemoryCard); absent → create (createStandaloneCard). Both actions redirect
// to /memory-cards on success (redirect throws), so the form only ever observes the failure branch.
// `sourceNote` (edit of a linked card) renders a source-note row + an Unlink action.
type CardFormPropsT = {
  subjects: SubjectT[]
  card?: MemoryCardT
  sourceNote?: { id: string; title: string | null }
}

export function CardForm({ subjects, card, sourceNote }: CardFormPropsT) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | undefined>(undefined)
  const { isPending: isUnlinking, run: runUnlink } = useActionTransition()

  const subjectOptions = useMemo(
    () => [
      { value: NO_SUBJECT, label: 'None' },
      ...subjects.map((subject) => ({ value: subject.id, label: subject.title })),
    ],
    [subjects],
  )

  const form = useAppForm({
    defaultValues: {
      subject_id: card?.subject_id ?? null,
      prompt: card?.prompt ?? '',
      example: card?.example ?? '',
      code_context: card?.code_context ?? '',
    },
    onSubmit: async ({ value }) => {
      const result = card
        ? await updateMemoryCard(card.id, value)
        : await createStandaloneCard(value)
      if (!toastActionResult(result)) setFormError(result.error)
    },
  })

  return (
    <form
      className="flex flex-col gap-4"
      data-testid="card-form"
      onSubmit={(e) => {
        e.preventDefault()
        setFormError(undefined)
        form.handleSubmit()
      }}
    >
      <form.Field name="subject_id">
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={field.name}>Subject (optional)</Label>
            <Combobox
              id={field.name}
              value={field.state.value ?? NO_SUBJECT}
              onChange={(v) => field.handleChange(v === NO_SUBJECT ? null : v)}
              options={subjectOptions}
              searchPlaceholder="Search subject…"
              emptyMessage="No subject found."
              className="w-full sm:w-72"
            />
          </div>
        )}
      </form.Field>

      <form.AppField name="prompt" validators={{ onBlur: promptSchema, onSubmit: promptSchema }}>
        {(field) => <field.Input label="Question" placeholder="What should you recall?" />}
      </form.AppField>

      <form.Field name="example">
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor="card-example">Example (optional)</Label>
            <Textarea
              id="card-example"
              data-testid="card-form-example"
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

      {sourceNote && card && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span className="text-muted-foreground">
            Source note:{' '}
            <ButtonLink href={`/notes/${sourceNote.id}`} variant="link" className="h-auto p-0">
              {sourceNote.title ?? 'Untitled'}
            </ButtonLink>
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="card-unlink"
            disabled={isUnlinking}
            onClick={() =>
              runUnlink(() => unlinkCardFromNote(card.id, sourceNote.id), {
                successMessage: 'Card unlinked',
              }).then((result) => {
                if (result.success) router.refresh()
              })
            }
          >
            {isUnlinking ? 'Unlinking…' : 'Unlink'}
          </Button>
        </div>
      )}

      <FormError message={formError} />

      <div className="flex items-center gap-2">
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" data-testid="card-form-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : card ? 'Save changes' : 'Create card'}
            </Button>
          )}
        </form.Subscribe>
        <ButtonLink href="/memory-cards" variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  )
}
