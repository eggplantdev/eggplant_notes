'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

import { NoteNavLink } from '@/features/subjects/components/note-nav-link'
import { cn } from '@/lib/utils'

type SortableNoteRowPropsT = {
  subjectId: string
  id: string
  title: string | null
  isActive: boolean
  onNavigate?: () => void
}

// The grip is a mouse-only drag handle (NOT keyboard-focusable — `tabIndex=-1`, no dnd
// `attributes`/KeyboardSensor) so keyboard nav is one Tab stop per row (the link) + arrow keys,
// not a grip→link two-step. Keyboard reorder is intentionally dropped here; the continuous-view
// ToC keeps it.
export function SortableNoteRow({
  subjectId,
  id,
  title,
  isActive,
  onNavigate,
}: SortableNoteRowPropsT) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-center gap-1', isDragging && 'opacity-60')}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        tabIndex={-1}
        className="text-muted-foreground hover:text-foreground shrink-0 cursor-grab touch-none rounded p-1.5"
        {...listeners}
      >
        <GripVertical className="size-5" />
      </button>
      <NoteNavLink
        subjectId={subjectId}
        id={id}
        title={title}
        isActive={isActive}
        onNavigate={onNavigate}
      />
    </li>
  )
}
