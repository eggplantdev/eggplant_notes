'use client'

import { useState } from 'react'

import { EditorWithPreview } from '@/components/markdown/editor-with-preview'
import { AccordionArrow } from '@/components/ui/accordion-arrow'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { ImportDraftT } from '@/features/import/types'

// Human-in-the-loop gate: nothing commits until the user has reviewed, edited, or skipped each note.
export function NotePreviewList({
  drafts,
  onPatch,
  onToggleSkip,
}: {
  drafts: ImportDraftT[]
  onPatch: (id: string, patch: Partial<Pick<ImportDraftT, 'title' | 'content'>>) => void
  onToggleSkip: (id: string) => void
}) {
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
        // A skipped note's body stays closed even while `isOpen` is true, so it reopens where the user
        // left it once it's included again.
        const isExpanded = isOpen && !draft.skip
        return (
          <li
            key={draft.id}
            data-testid="import-note-row"
            className={cn('relative rounded-lg border p-4', draft.skip && 'opacity-50')}
          >
            <Collapsible open={isExpanded} onOpenChange={() => toggleCollapsed(draft.id)}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  aria-label={isExpanded ? 'Collapse note' : 'Expand note'}
                  className="group absolute top-3 right-3 cursor-pointer"
                >
                  <AccordionArrow isOpen={isExpanded} />
                </button>
              </CollapsibleTrigger>
              <div className="mb-3 flex items-end gap-2">
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
              <CollapsibleContent>
                <EditorWithPreview
                  value={draft.content}
                  onChange={(content) => onPatch(draft.id, { content })}
                />
              </CollapsibleContent>
            </Collapsible>
          </li>
        )
      })}
    </ul>
  )
}
