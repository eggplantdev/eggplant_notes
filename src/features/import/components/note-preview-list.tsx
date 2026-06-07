'use client'

import { EditorWithPreview } from '@/components/markdown/editor-with-preview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { ImportDraftT } from '@/features/import/types'

// Editable, skippable preview of the split result. The preview IS the human-in-the-loop gate: nothing
// commits until the user has seen (and can edit/skip) each note — so a bad split or a duplicate is a
// manual fix here, never silent garbage under RLS.
export function NotePreviewList({
  drafts,
  onPatch,
  onToggleSkip,
}: {
  drafts: ImportDraftT[]
  onPatch: (id: string, patch: Partial<Pick<ImportDraftT, 'title' | 'content'>>) => void
  onToggleSkip: (id: string) => void
}) {
  return (
    <ul className="flex flex-col gap-4">
      {drafts.map((draft) => (
        <li
          key={draft.id}
          data-testid="import-note-row"
          className={cn('rounded-lg border p-4', draft.skip && 'opacity-50')}
        >
          <div className="mb-3 flex items-center gap-2">
            <div className="grid flex-1 gap-2">
              <Label htmlFor={`import-title-${draft.id}`}>Title</Label>
              <Input
                id={`import-title-${draft.id}`}
                data-testid="import-note-title"
                value={draft.title}
                disabled={draft.skip}
                onChange={(e) => onPatch(draft.id, { title: e.target.value })}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="import-note-skip"
              className="mt-7"
              onClick={() => onToggleSkip(draft.id)}
            >
              {draft.skip ? 'Include' : 'Skip'}
            </Button>
          </div>
          {!draft.skip && (
            <EditorWithPreview
              value={draft.content}
              onChange={(content) => onPatch(draft.id, { content })}
            />
          )}
        </li>
      ))}
    </ul>
  )
}
