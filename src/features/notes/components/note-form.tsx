'use client'

import { useMemo, useState } from 'react'

import { EditorWithPreview } from '@/components/markdown/editor-with-preview'
import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormError } from '@/components/forms/hooks/use-form-error'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { generateNotes } from '@/features/openrouter/actions/generate-notes'
import { TopicGenerator } from '@/features/openrouter/components/topic-generator'
import { MemoryCardsField } from '@/features/notes/components/memory-cards-field'
import {
  MoveLinkedCardsDialog,
  type LinkedCardT,
} from '@/features/notes/components/move-linked-cards-dialog'
import { titleSchema } from '@/features/notes/schemas'
import type { CreateNoteWithChecksT, NoteInputT, StagedCheckInputT } from '@/features/notes/schemas'
import { SubjectSelect, type SubjectChoiceT } from '@/features/subjects/components/subject-select'
import type { SubjectOptionT } from '@/features/subjects/types'
import type { NoteT } from '@/types/note'
import type { ActionResultT } from '@/types/action'

// Combobox needs a concrete option value; unassigned note ↔ this sentinel ↔ null on the way out.
const NO_SUBJECT = 'none'

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
      // The user's persisted default model, pre-selected in the generate dialog.
      defaultModel: string
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
  const { formError, clearError, reportResult } = useFormError()
  // Holds the edit input while the move/unlink dialog is open; the dialog's choices resume submit.
  const [pendingInput, setPendingInput] = useState<NoteInputT | undefined>(undefined)
  // #5 ungrounded gen-notes: a topic → AI fills the title/content fields below for the user to edit
  // before saving. Create mode only; the generator itself gates on OpenRouter connection.
  const isCreateMode = !props.note

  // Memoized so the form's frequent re-renders (typing) don't re-allocate the option list each keystroke.
  const subjectOptions = useMemo(
    () => [
      { value: NO_SUBJECT, label: 'None' },
      ...props.subjects.map((subject) => ({ value: subject.id, label: subject.title })),
    ],
    [props.subjects],
  )

  const defaultSubjectId = props.note ? null : (props.defaultSubjectId ?? null)
  // Create-mode subject choice (existing/None or a new subject by name) lives outside the form: it's a
  // two-field control and resolves to subject_id OR subject_title at submit. Edit mode keeps the plain
  // subject_id Combobox below (no inline new-subject need there).
  const [subjectChoice, setSubjectChoice] = useState<SubjectChoiceT>({
    mode: 'existing',
    subjectId: defaultSubjectId,
  })

  const form = useAppForm({
    defaultValues: {
      title: note?.title ?? '',
      content: note?.content ?? '',
      subject_id: note?.subject_id ?? defaultSubjectId,
      checks: [] as StagedCheckInputT[],
    },
    onSubmit: async ({ value }) => {
      if (!props.note) {
        // Resolve the subject choice into the create payload: an existing id (or null = None), or a
        // new subject title the RPC will create. A new-mode choice with no name is a validation stop.
        let subjectFields: { subject_id?: string | null; subject_title?: string }
        if (subjectChoice.mode === 'new') {
          const newTitle = subjectChoice.title.trim()
          if (!newTitle) {
            reportResult({ success: false, error: 'Name the new subject.' })
            return
          }
          subjectFields = { subject_id: null, subject_title: newTitle }
        } else {
          subjectFields = { subject_id: subjectChoice.subjectId }
        }
        const result = await props.action({
          note: { title: value.title, content: value.content, ...subjectFields },
          checks: value.checks,
        })
        reportResult(result)
        return
      }
      const noteInput: NoteInputT = {
        title: value.title,
        content: value.content,
        subject_id: value.subject_id,
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
    reportResult(result)
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        clearError()
        form.handleSubmit()
      }}
    >
      {isCreateMode && (
        <TopicGenerator
          label="Generate with AI"
          placeholder="e.g. The actor model of concurrency"
          testIdPrefix="note-ai"
          task="notes"
          connected={props.aiEnabled ?? false}
          defaultModel={props.defaultModel}
          action={(topic, modelId, promptOverride) =>
            generateNotes({ topic, modelId, promptOverride })
          }
          onResult={(genNote) => {
            form.setFieldValue('title', genNote.title)
            form.setFieldValue('content', genNote.content)
          }}
          resultNoun="note"
          applyHint="Note filled in below — edit if needed, then Create note to save."
        />
      )}

      <form.AppField name="title" validators={{ onBlur: titleSchema, onSubmit: titleSchema }}>
        {(field) => <field.Input label="Title" placeholder="Note title" />}
      </form.AppField>

      {isCreateMode ? (
        <div className="grid gap-2">
          <Label>Subject</Label>
          <SubjectSelect
            subjects={props.subjects}
            value={subjectChoice}
            onChange={setSubjectChoice}
            allowNone
            testIdPrefix="note-subject"
          />
        </div>
      ) : (
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
      )}

      <form.Field name="content">
        {(field) => <EditorWithPreview value={field.state.value} onChange={field.handleChange} />}
      </form.Field>

      {/* Inline memory-card staging — create mode only; edit manages cards on the detail page. */}
      {!note && (
        <MemoryCardsField
          form={form}
          aiEnabled={props.aiEnabled ?? false}
          defaultModel={props.defaultModel}
        />
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
