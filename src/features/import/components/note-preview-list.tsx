'use client'

import { useState } from 'react'

import { EditorWithPreview } from '@/components/markdown/editor-with-preview'
import { AccordionArrow } from '@/components/ui/accordion-arrow'
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
  // Per-note collapse, default expanded; a Set of collapsed ids keeps the common (all-open) case empty.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <ul className="flex flex-col gap-4">
      {drafts.map((draft) => {
        const isOpen = !collapsed.has(draft.id)
        return (
          <li
            key={draft.id}
            data-testid="import-note-row"
            className={cn('relative rounded-lg border p-4', draft.skip && 'opacity-50')}
          >
            <button
              type="button"
              onClick={() => toggleCollapsed(draft.id)}
              aria-expanded={isOpen}
              aria-controls={`import-note-body-${draft.id}`}
              aria-label={isOpen ? 'Collapse note' : 'Expand note'}
              className="group absolute top-3 right-3 cursor-pointer"
            >
              <AccordionArrow isOpen={isOpen} />
            </button>
            <div className="mb-3 flex items-end gap-2 pr-7">
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
                variant="glowy-red"
                data-testid="import-note-skip"
                onClick={() => onToggleSkip(draft.id)}
              >
                {draft.skip ? 'Include' : 'Skip'}
              </Button>
            </div>
            {!draft.skip && isOpen && (
              <div id={`import-note-body-${draft.id}`}>
                <EditorWithPreview
                  value={draft.content}
                  onChange={(content) => onPatch(draft.id, { content })}
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
