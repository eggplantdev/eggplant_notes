'use client'

import { useMemo, useState } from 'react'

import { CodeBlockInserter } from '@/components/markdown/code-block-inserter'
import { EditorWithPreview } from '@/components/markdown/editor-with-preview'
import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { toastActionResult } from '@/components/forms/toast-result'
import { MarkdownEditor } from '@/components/markdown/markdown-editor'
import { MarkdownPreview } from '@/components/markdown/markdown-preview'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MoveLinkedCardsDialog, type LinkedCardT } from '@/features/notes/move-linked-cards-dialog'
import { titleSchema } from '@/features/notes/schemas'
import type { CreateNoteWithChecksT, NoteInputT, StagedCheckInputT } from '@/features/notes/schemas'
import { promptSchema } from '@/features/memory-cards/schemas'
import type { NoteT } from '@/types/note'
import type { SubjectT } from '@/types/subject'
import type { ActionResultT } from '@/types/action'

// "None" sentinel for the subject Combobox: an unassigned note maps to this constant for the
// picker and back to null on the way out (the Combobox needs a concrete option value).
const NO_SUBJECT = 'none'

// A memory card staged client-side before the note exists (S-07). Shape is derived from
// memoryCardInputSchema's input type (StagedCheckInputT) so it can't drift; blanks are coerced
// to null server-side by its `optionalText` transform.
const EMPTY_CHECK: StagedCheckInputT = { prompt: '', example: '', code_context: '' }

// `note` present → edit (action needs the id); absent → create. The union lets TS narrow
// the action signature off `note`'s truthiness. Create now sends a note + its staged checks
// together (CreateNoteWithChecksT); edit keeps the note-only NoteInputT contract, plus a
// `moveLinkedCards` flag set by the subject-change confirm dialog (standalone-memory-cards).
// `subjects` feeds the assignment picker. `defaultSubjectId` (create only) pre-selects a
// subject — set when arriving from a subject's "New note" entry point (?subject=<id>).
// `linkedCards` (edit only) drives the per-card move/unlink dialog on a subject change.
type NoteFormPropsT =
  | {
      action: (input: CreateNoteWithChecksT) => Promise<ActionResultT>
      subjects: SubjectT[]
      defaultSubjectId?: string
      note?: undefined
    }
  | {
      action: (
        id: string,
        input: NoteInputT,
        cardActions?: { move: string[]; unlink: string[] },
      ) => Promise<ActionResultT>
      subjects: SubjectT[]
      note: NoteT
      linkedCards: LinkedCardT[]
    }

// Create/edit form. Title is a managed `AppField` (Zod-validated); the body lives in form
// state but is rendered through the controlled CodeMirror island + a client preview pane.
// In create mode the user can stage 0..N memory cards inline (a TanStack array field) and
// they save atomically with the note. On success the server action redirects (throws), so the
// form only ever sees the failure branch — mirrors sign-up/page.tsx. The Shiki-highlighted
// render is the saved detail view; this preview stays plain to keep highlighting bytes off the client.
export function NoteForm(props: NoteFormPropsT) {
  const { note } = props
  const [formError, setFormError] = useState<string | undefined>(undefined)
  // When editing a note WITH linked cards and the subject changes, submit pauses here and the
  // per-card move/unlink dialog opens; the user's choices resume it. Undefined when no prompt is
  // pending. (standalone-memory-cards)
  const [pendingInput, setPendingInput] = useState<NoteInputT | undefined>(undefined)

  // "None" + the user's subjects, shaped for the Combobox. Memoized so the form's frequent
  // re-renders (typing, tab toggles) don't re-allocate the list.
  const subjectOptions = useMemo(
    () => [
      { value: NO_SUBJECT, label: 'None' },
      ...props.subjects.map((subject) => ({ value: subject.id, label: subject.title })),
    ],
    [props.subjects],
  )

  // Edit mode takes the saved subject; create mode honors a pre-selected one from the URL.
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
      // Edit: a subject change on a note that has linked cards opens the per-card move/unlink
      // dialog before saving. Plain title/content edits skip it.
      const subjectChanged = value.subject_id !== props.note.subject_id
      if (subjectChanged && props.linkedCards.length > 0) {
        setPendingInput(noteInput)
        return
      }
      await submitEdit(noteInput)
    },
  })

  // Resume an edit submit, optionally carrying the per-card move/unlink decisions. `props.note` is
  // the edit variant here — onSubmit only calls this on the edit path. Success redirects (throws),
  // so only the failure branch is observed; clear the prompt either way.
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

      {/* Inline memory-card staging — create mode only. Edit keeps the detail-page section (S-02). */}
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
                        <div className="flex items-center justify-between gap-2">
                          <Label>Code context (optional)</Label>
                          <CodeBlockInserter
                            value={field.state.value}
                            onChange={field.handleChange}
                          />
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

      {/* Per-card move/unlink prompt (edit only) — mounted only while a decision is pending, so it
          starts fresh each time. Escape / Cancel aborts the save entirely. */}
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
