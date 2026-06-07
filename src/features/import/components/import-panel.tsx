'use client'

import { useState, useTransition } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { toastActionResult } from '@/components/forms/toast-result'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { importNotes } from '@/features/import/actions/import-notes'
import { MAX_IMPORT_BYTES, MAX_IMPORT_NOTES } from '@/features/import/constants'
import { NotePreviewList } from '@/features/import/components/note-preview-list'
import { SourceInput } from '@/features/import/components/source-input'
import type { ImportDraftT } from '@/features/import/types'
import { splitMarkdown, type SplitLevelT } from '@/features/import/utils/split-markdown'
import { generateNotes } from '@/features/openrouter/actions/generate-notes'
import { GenerateDialog } from '@/features/openrouter/components/generate-dialog'
import type { GeneratedNoteT } from '@/features/openrouter/ai-schemas'
import type { SubjectOptionT } from '@/features/subjects/types'
import { MutedText } from '@/components/ui/muted-text'

const LEVELS: SplitLevelT[] = [1, 2, 3]
type SubjectModeT = 'existing' | 'new'

// Shown by both source-consuming controls (split buttons + AI decompose) when there's no text yet.
const NO_SOURCE_MSG = 'Paste or upload some text first.'

function toDraft(section: { title: string; content: string }): ImportDraftT {
  return { id: crypto.randomUUID(), title: section.title, content: section.content, skip: false }
}

// Orchestrates the deterministic pipeline: source text → heading-split at the chosen level → editable
// preview → commit under a subject. Re-splitting is an explicit event (source change / level change),
// never a derived effect, so it can't fight the user's edits mid-keystroke — changing the level
// rebuilds the preview and discards edits by design.
export function ImportPanel({
  subjects,
  aiEnabled = false,
  defaultModel,
}: {
  subjects: SubjectOptionT[]
  // Whether OpenRouter is connected. The AI decompose control (#3) is always shown alongside the
  // split (#4); when not connected, the dialog intercepts with the connect gate.
  aiEnabled?: boolean
  // The user's persisted default model, pre-selected in the generate dialog.
  defaultModel: string
}) {
  const [text, setText] = useState('')
  const [level, setLevel] = useState<SplitLevelT>(1)
  const [drafts, setDrafts] = useState<ImportDraftT[]>([])
  const [subjectMode, setSubjectMode] = useState<SubjectModeT>('new')
  const [subjectId, setSubjectId] = useState<string | undefined>(undefined)
  const [newTitle, setNewTitle] = useState('')
  const [formError, setFormError] = useState<string | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  // #3: AI decomposes the source text into multiple notes, feeding the SAME preview/commit pipeline
  // as the deterministic split — the two read-strategies converge on `drafts`.
  function applyDecomposition(notes: GeneratedNoteT[]) {
    setFormError(undefined)
    setDrafts(notes.map(toDraft))
  }

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
    // Clicking a level with no source is the same dead-end as the AI trigger — give feedback rather
    // than silently doing nothing.
    if (!text.trim()) {
      setFormError(NO_SOURCE_MSG)
      return
    }
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
      {/* Intro up front, under the page header — explain the two paths BEFORE the controls. */}
      <div className="text-muted-foreground flex flex-col gap-2 text-sm">
        <p>Paste text or upload a Markdown file, then turn it into notes in one of two ways:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <span className="text-foreground font-medium">Split</span> — cut the document at its
            headings (H1, H2, or H3). Instant and exact; best when it&apos;s already
            well-structured.
          </li>
          <li>
            <span className="text-foreground font-medium">Decompose with AI</span> — your connected
            model reads the text and groups it into notes by topic. Best for messy or unstructured
            prose.
          </li>
        </ul>
        <p>Either way, you can edit, rename, or skip notes before saving.</p>
      </div>

      <div className="flex flex-col gap-3">
        <Label>Select subject</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={subjectMode}
          onValueChange={(v) => v && setSubjectMode(v as SubjectModeT)}
        >
          <ToggleGroupItem value="new" data-testid="import-subject-new-mode">
            New subject
          </ToggleGroupItem>
          <ToggleGroupItem
            value="existing"
            data-testid="import-subject-existing-mode"
            disabled={subjects.length === 0}
          >
            Existing subject
          </ToggleGroupItem>
        </ToggleGroup>
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

      <SourceInput value={text} onChange={handleSource} />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">Split on heading level:</span>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={String(level)}
            onValueChange={(v) => v && handleLevel(Number(v) as SplitLevelT)}
          >
            {LEVELS.map((l) => (
              <ToggleGroupItem key={l} value={String(l)} data-testid={`import-level-h${l}`}>
                {`H${l}`}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <GenerateDialog<GeneratedNoteT>
            connected={aiEnabled}
            defaultModel={defaultModel}
            previewInput={{ task: 'notes', text }}
            action={(modelId, promptOverride) => generateNotes({ text, modelId, promptOverride })}
            onResult={applyDecomposition}
            triggerLabel="Decompose with AI"
            triggerTestId="import-decompose-ai"
            validate={() => (text.trim().length === 0 ? NO_SOURCE_MSG : undefined)}
            dialogTitle="Decompose into notes with AI"
          />
        </div>

        <MutedText>
          Each H{level} heading becomes a note titled from that heading; deeper headings stay in its
          body. Text before the first H{level} heading becomes an “Untitled” note you can rename or
          skip.
        </MutedText>
      </div>

      {drafts.length > 0 && (
        <>
          <div>
            <h2 className="text-lg font-semibold">
              Preview — {keptCount} note{keptCount === 1 ? '' : 's'}
            </h2>
            <p className="text-muted-foreground mt-1 mb-3 text-sm">
              Edit any title or body, or skip notes you don&apos;t want, before importing. Changing
              the split level re-splits and discards these edits.
            </p>
            <NotePreviewList drafts={drafts} onPatch={patchDraft} onToggleSkip={toggleSkip} />
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
