'use client'

import { useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { MarkdownEditor } from '@/components/markdown/markdown-editor'
import { MarkdownPreview } from '@/components/markdown/markdown-preview'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { titleSchema } from '@/features/notes/schemas'
import type { NoteInputT } from '@/features/notes/schemas'
import type { NoteT } from '@/features/notes/types'
import type { SubjectT } from '@/features/subjects/types'
import { cn } from '@/lib/utils'
import type { ActionResultT } from '@/types/action'

// "None" sentinel: Radix Select forbids an empty-string item value, so unassigned maps to
// this constant and back to null on the way out.
const NO_SUBJECT = 'none'

// `note` present → edit (action needs the id); absent → create. The union lets TS narrow
// the action signature off `note`'s truthiness. `subjects` feeds the assignment picker.
type NoteFormPropsT =
  | {
      action: (input: NoteInputT) => Promise<ActionResultT>
      subjects: SubjectT[]
      note?: undefined
    }
  | {
      action: (id: string, input: NoteInputT) => Promise<ActionResultT>
      subjects: SubjectT[]
      note: NoteT
    }

type MobileTabT = 'write' | 'preview'

// Create/edit form. Title is a managed `AppField` (Zod-validated); the body lives in form
// state but is rendered through the controlled CodeMirror island + a client preview pane.
// On success the server action redirects (throws), so the form only ever sees the failure
// branch — mirrors sign-up/page.tsx. The Shiki-highlighted render is the saved detail
// view; this preview stays plain to keep highlighting bytes off the client.
export function NoteForm(props: NoteFormPropsT) {
  const { note } = props
  const [formError, setFormError] = useState<string | undefined>(undefined)
  const [mobileTab, setMobileTab] = useState<MobileTabT>('write')

  const form = useAppForm({
    defaultValues: {
      title: note?.title ?? '',
      content: note?.content ?? '',
      subject_id: note?.subject_id ?? null,
    },
    onSubmit: async ({ value }) => {
      const result = props.note
        ? await props.action(props.note.id, value)
        : await props.action(value)
      if (!result.success) setFormError(result.error)
    },
  })

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setFormError(undefined)
        form.handleSubmit()
      }}
    >
      <form.AppField name="title" validators={{ onBlur: titleSchema, onSubmit: titleSchema }}>
        {(field) => <field.Input label="Title" placeholder="Note title" />}
      </form.AppField>

      <form.Field name="subject_id">
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={field.name}>Subject</Label>
            <Select
              value={field.state.value ?? NO_SUBJECT}
              onValueChange={(v) => field.handleChange(v === NO_SUBJECT ? null : v)}
            >
              <SelectTrigger id={field.name} className="w-full sm:w-72">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SUBJECT}>None</SelectItem>
                {props.subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>

      <form.Field name="content">
        {(field) => (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 md:hidden" role="tablist">
              <Button
                type="button"
                size="sm"
                variant={mobileTab === 'write' ? 'default' : 'outline'}
                onClick={() => setMobileTab('write')}
              >
                Write
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mobileTab === 'preview' ? 'default' : 'outline'}
                onClick={() => setMobileTab('preview')}
              >
                Preview
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div
                className={cn('min-w-0', mobileTab === 'write' ? 'block' : 'hidden', 'md:block')}
              >
                <MarkdownEditor value={field.state.value} onChange={field.handleChange} />
              </div>
              <div
                className={cn(
                  'prose dark:prose-invert h-80 max-w-none min-w-0 overflow-auto rounded-lg border p-4',
                  mobileTab === 'preview' ? 'block' : 'hidden',
                  'md:block',
                )}
              >
                <MarkdownPreview content={field.state.value} />
              </div>
            </div>
          </div>
        )}
      </form.Field>

      <FormError message={formError} />

      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting} className="self-start">
            {isSubmitting ? 'Saving…' : note ? 'Save changes' : 'Create note'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  )
}
