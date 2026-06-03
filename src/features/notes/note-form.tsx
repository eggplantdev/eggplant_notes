'use client'

import { useMemo, useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { MarkdownEditor } from '@/components/markdown/markdown-editor'
import { MarkdownPreview } from '@/components/markdown/markdown-preview'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { CODE_LANGUAGES } from '@/features/notes/constants'
import { titleSchema } from '@/features/notes/schemas'
import type { NoteInputT } from '@/features/notes/schemas'
import type { NoteT } from '@/types/note'
import type { SubjectT } from '@/types/subject'
import { cn } from '@/lib/utils'
import type { ActionResultT } from '@/types/action'

// "None" sentinel for the subject Combobox: an unassigned note maps to this constant for the
// picker and back to null on the way out (the Combobox needs a concrete option value).
const NO_SUBJECT = 'none'

// Appends an empty fenced code block in `lang` to the markdown body, normalizing the gap so
// the fence always opens on its own blank line. Pure — the result is fed to the content field.
function appendCodeBlock(content: string, lang: string) {
  const block = '```' + lang + '\n\n```\n'
  if (!content) return block
  // Strip trailing newlines then re-add exactly one blank line, so the fence always opens on
  // its own blank line regardless of how the body currently ends.
  return content.replace(/\n+$/, '') + '\n\n' + block
}

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

  // "None" + the user's subjects, shaped for the Combobox. Memoized so the form's frequent
  // re-renders (typing, tab toggles) don't re-allocate the list.
  const subjectOptions = useMemo(
    () => [
      { value: NO_SUBJECT, label: 'None' },
      ...props.subjects.map((subject) => ({ value: subject.id, label: subject.title })),
    ],
    [props.subjects],
  )

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

      <form.Field name="content">
        {(field) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {/* Action-style picker: no bound value, so selecting a language re-fires each
                  time and appends another block to the body — never persisted on the note. */}
              <Combobox
                options={CODE_LANGUAGES}
                onChange={(lang) => field.handleChange(appendCodeBlock(field.state.value, lang))}
                placeholder="Insert code block…"
                searchPlaceholder="Search language…"
                emptyMessage="No language found."
                className="w-48"
              />
              <div className="ml-auto flex gap-2 md:hidden" role="tablist">
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
