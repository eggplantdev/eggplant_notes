'use client'

import { useMemo, useState } from 'react'

import { EditorWithPreview } from '@/components/markdown/editor-with-preview'
import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { toastActionResult } from '@/components/forms/toast-result'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { generateNotes } from '@/features/openrouter/actions/generate-notes'
import { TopicGenerator } from '@/features/openrouter/components/topic-generator'
import {
  MoveLinkedCardsDialog,
  type LinkedCardT,
} from '@/features/notes/components/move-linked-cards-dialog'
import { titleSchema } from '@/features/notes/schemas'
import type { CreateNoteWithChecksT, NoteInputT, StagedCheckInputT } from '@/features/notes/schemas'
import { promptSchema } from '@/features/memory-cards/schemas'
import type { SubjectOptionT } from '@/features/subjects/types'
import type { NoteT } from '@/types/note'
import type { ActionResultT } from '@/types/action'

// Combobox needs a concrete option value; unassigned note ↔ this sentinel ↔ null on the way out.
const NO_SUBJECT = 'none'

// Blank optional fields are coerced to null server-side by the schema's `optionalText` transform.
const EMPTY_CHECK: StagedCheckInputT = { prompt: '', example: '', code_context: '' }

// `note` present discriminates edit (action takes the id) from create. Create saves the note +
// staged checks atomically; edit is note-only plus optional per-card move/unlink actions.
type NoteFormPropsT =
  | {
      action: (input: CreateNoteWithChecksT) => Promise<ActionResultT>
      subjects: SubjectOptionT[]
      defaultSubjectId?: string
      note?: undefined
      // OpenRouter connected → offer the AI "generate a note from a topic" filler (#5).
      aiEnabled?: boolean
    }
  | {
      action: (
        id: string,
        input: NoteInputT,
        cardActions?: { move: string[]; unlink: string[] },
      ) => Promise<ActionResultT>
      subjects: SubjectOptionT[]
      note: NoteT
      linkedCards: LinkedCardT[]
    }

// On success the server action redirects (throws), so the form only ever sees the failure branch.
export function NoteForm(props: NoteFormPropsT) {
  const { note } = props
  const [formError, setFormError] = useState<string | undefined>(undefined)
  // Holds the edit input while the move/unlink dialog is open; the dialog's choices resume submit.
  const [pendingInput, setPendingInput] = useState<NoteInputT | undefined>(undefined)
  // #5 ungrounded gen-notes: a topic → AI fills the title/content fields below for the user to edit
  // before saving. Create mode only.
  const canUseAi = props.note ? false : (props.aiEnabled ?? false)

  // Memoized so the form's frequent re-renders (typing) don't re-allocate the option list.
  const subjectOptions = useMemo(
    () => [
      { value: NO_SUBJECT, label: 'None' },
      ...props.subjects.map((subject) => ({ value: subject.id, label: subject.title })),
    ],
    [props.subjects],
  )

  const defaultSubjectId = props.note ? null : (props.defaultSubjectId ?? null)

  const form = useAppForm({
    defaultValues: {
      title: note?.title ?? '',
      content: note?.content ?? '',
      subject_id: note?.subject_id ?? defaultSubjectId,
      checks: [] as StagedCheckInputT[],
    },
    onSubmit: async ({ value }) => {
      const noteInput: NoteInputT = {
        title: value.title,
        content: value.content,
        subject_id: value.subject_id,
      }
      if (!props.note) {
        const result = await props.action({ note: noteInput, checks: value.checks })
        if (!toastActionResult(result)) setFormError(result.error)
        return
      }
      // A subject change on a note with linked cards opens the move/unlink dialog before saving.
      const subjectChanged = value.subject_id !== props.note.subject_id
      if (subjectChanged && props.linkedCards.length > 0) {
        setPendingInput(noteInput)
        return
      }
      await submitEdit(noteInput)
    },
  })

  async function submitEdit(
    noteInput: NoteInputT,
    cardActions?: { move: string[]; unlink: string[] },
  ) {
    if (!props.note) return
    setPendingInput(undefined)
    const result = await props.action(props.note.id, noteInput, cardActions)
    if (!toastActionResult(result)) setFormError(result.error)
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setFormError(undefined)
        form.handleSubmit()
      }}
    >
      {canUseAi && (
        <TopicGenerator
          label="Generate a note from a topic (AI)"
          placeholder="e.g. The actor model of concurrency"
          testIdPrefix="note-ai"
          inputClassName="sm:w-96"
          action={(topic) => generateNotes({ topic })}
          onResult={(genNote) => {
            form.setFieldValue('title', genNote.title)
            form.setFieldValue('content', genNote.content)
          }}
        />
      )}

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
        {(field) => <EditorWithPreview value={field.state.value} onChange={field.handleChange} />}
      </form.Field>

      {/* Inline memory-card staging — create mode only; edit manages cards on the detail page. */}
      {!note && (
        <form.Field name="checks" mode="array">
          {(checksField) => (
            <div className="flex flex-col gap-4 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <Label>Memory cards (optional)</Label>
                  <span className="text-muted-foreground text-sm">
                    Add recall questions to save alongside this note.
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => checksField.pushValue(EMPTY_CHECK)}
                >
                  Add card
                </Button>
              </div>

              {checksField.state.value.map((_, i) => (
                <div key={i} className="flex flex-col gap-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Card {i + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => checksField.removeValue(i)}
                    >
                      Remove
                    </Button>
                  </div>

                  <form.AppField
                    name={`checks[${i}].prompt`}
                    validators={{ onBlur: promptSchema, onSubmit: promptSchema }}
                  >
                    {(field) => (
                      <field.Input label="Question" placeholder="What should you recall?" />
                    )}
                  </form.AppField>

                  <form.Field name={`checks[${i}].example`}>
                    {(field) => (
                      <div className="grid gap-2">
                        <Label htmlFor={`card-${i}-example`}>Example (optional)</Label>
                        <Textarea
                          id={`card-${i}-example`}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="A worked example or expected answer"
                        />
                      </div>
                    )}
                  </form.Field>

                  <form.Field name={`checks[${i}].code_context`}>
                    {(field) => (
                      <div className="flex flex-col gap-2">
                        <Label>Code context (optional)</Label>
                        <EditorWithPreview
                          value={field.state.value}
                          onChange={field.handleChange}
                        />
                      </div>
                    )}
                  </form.Field>
                </div>
              ))}
            </div>
          )}
        </form.Field>
      )}

      <FormError message={formError} />

      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting} className="self-start">
            {isSubmitting ? 'Saving…' : note ? 'Save changes' : 'Create note'}
          </Button>
        )}
      </form.Subscribe>

      {/* Mounted only while pending so it starts fresh each time; Cancel aborts the save. */}
      {props.note && pendingInput && (
        <MoveLinkedCardsDialog
          cards={props.linkedCards}
          onConfirm={(actions) => submitEdit(pendingInput, actions)}
          onCancel={() => setPendingInput(undefined)}
        />
      )}
    </form>
  )
}
