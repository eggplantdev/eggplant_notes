'use client'

import { useState, useTransition } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { toastActionResult } from '@/components/forms/toast-result'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { importNotes } from '@/features/import/actions/import-notes'
import { MAX_IMPORT_BYTES, MAX_IMPORT_NOTES } from '@/features/import/constants'
import { NotePreviewList } from '@/features/import/components/note-preview-list'
import { SourceInput } from '@/features/import/components/source-input'
import type { ImportDraftT } from '@/features/import/types'
import { splitMarkdown, type SplitLevelT } from '@/features/import/utils/split-markdown'
import type { SubjectOptionT } from '@/features/subjects/types'

const LEVELS: SplitLevelT[] = [1, 2, 3]
type SubjectModeT = 'existing' | 'new'

function toDraft(section: { title: string; content: string }): ImportDraftT {
  return { id: crypto.randomUUID(), title: section.title, content: section.content, skip: false }
}

// Orchestrates the deterministic pipeline: source text → heading-split at the chosen level → editable
// preview → commit under a subject. Re-splitting is an explicit event (source change / level change),
// never a derived effect, so it can't fight the user's edits mid-keystroke — changing the level
// rebuilds the preview and discards edits by design.
export function ImportPanel({ subjects }: { subjects: SubjectOptionT[] }) {
  const [text, setText] = useState('')
  const [level, setLevel] = useState<SplitLevelT>(1)
  const [drafts, setDrafts] = useState<ImportDraftT[]>([])
  const [subjectMode, setSubjectMode] = useState<SubjectModeT>('new')
  const [subjectId, setSubjectId] = useState<string | undefined>(undefined)
  const [newTitle, setNewTitle] = useState('')
  const [formError, setFormError] = useState<string | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  function regenerate(source: string, splitLevel: SplitLevelT) {
    setFormError(undefined)
    if (!source.trim()) {
      setDrafts([])
      return
    }
    if (new Blob([source]).size > MAX_IMPORT_BYTES) {
      setDrafts([])
      setFormError(`File is too large (max ${Math.round(MAX_IMPORT_BYTES / 1000)} KB).`)
      return
    }
    const sections = splitMarkdown(source, splitLevel)
    if (sections.length > MAX_IMPORT_NOTES) {
      setDrafts([])
      setFormError(`That splits into ${sections.length} notes (max ${MAX_IMPORT_NOTES}).`)
      return
    }
    setDrafts(sections.map(toDraft))
  }

  function handleSource(source: string) {
    setText(source)
    regenerate(source, level)
  }

  function handleLevel(next: SplitLevelT) {
    setLevel(next)
    regenerate(text, next)
  }

  function patchDraft(id: string, patch: Partial<Pick<ImportDraftT, 'title' | 'content'>>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  function toggleSkip(id: string) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, skip: !d.skip } : d)))
  }

  function handleImport() {
    setFormError(undefined)
    const notes = drafts.filter((d) => !d.skip).map(({ title, content }) => ({ title, content }))
    if (notes.length === 0) {
      setFormError('Add at least one note to import (all are skipped).')
      return
    }
    const subject =
      subjectMode === 'existing' ? { id: subjectId } : { title: newTitle.trim() || undefined }
    if (subjectMode === 'existing' && !subjectId) {
      setFormError('Pick a subject to import into.')
      return
    }
    if (subjectMode === 'new' && !newTitle.trim()) {
      setFormError('Name the new subject.')
      return
    }
    startTransition(async () => {
      const result = await importNotes({ subject, notes })
      if (result && !toastActionResult(result)) setFormError(result.error)
    })
  }

  const keptCount = drafts.filter((d) => !d.skip).length

  return (
    <div className="flex flex-col gap-6">
      <SourceInput value={text} onChange={handleSource} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">Split on heading level:</span>
        <div className="flex gap-2" role="group">
          {LEVELS.map((l) => (
            <Button
              key={l}
              type="button"
              size="sm"
              variant={level === l ? 'default' : 'outline'}
              data-testid={`import-level-h${l}`}
              onClick={() => handleLevel(l)}
            >
              {`H${l}`}
            </Button>
          ))}
        </div>
      </div>

      {drafts.length > 0 && (
        <>
          <div>
            <h2 className="mb-3 text-lg font-semibold">
              Preview — {keptCount} note{keptCount === 1 ? '' : 's'}
            </h2>
            <NotePreviewList drafts={drafts} onPatch={patchDraft} onToggleSkip={toggleSkip} />
          </div>

          <div className="flex flex-col gap-3 border-t pt-4">
            <Label>Import into</Label>
            <div className="flex gap-2" role="group">
              <Button
                type="button"
                size="sm"
                variant={subjectMode === 'new' ? 'default' : 'outline'}
                data-testid="import-subject-new-mode"
                onClick={() => setSubjectMode('new')}
              >
                New subject
              </Button>
              <Button
                type="button"
                size="sm"
                variant={subjectMode === 'existing' ? 'default' : 'outline'}
                data-testid="import-subject-existing-mode"
                disabled={subjects.length === 0}
                onClick={() => setSubjectMode('existing')}
              >
                Existing subject
              </Button>
            </div>
            {subjectMode === 'new' ? (
              <Input
                data-testid="import-subject-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="New subject name"
                className="sm:w-72"
              />
            ) : (
              <Combobox
                value={subjectId}
                onChange={setSubjectId}
                options={subjects.map((s) => ({ value: s.id, label: s.title }))}
                searchPlaceholder="Search subject…"
                emptyMessage="No subject found."
                className="w-full sm:w-72"
              />
            )}
          </div>

          <FormError message={formError} />

          <div>
            <Button
              type="button"
              data-testid="import-commit"
              disabled={isPending}
              onClick={handleImport}
            >
              {isPending ? 'Importing…' : `Import ${keptCount} note${keptCount === 1 ? '' : 's'}`}
            </Button>
          </div>
        </>
      )}

      {drafts.length === 0 && <FormError message={formError} />}
    </div>
  )
}
