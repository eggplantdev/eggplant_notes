'use client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { reorderNote } from '@/features/subjects/actions/reorder-note'
import { midpoint } from '@/features/subjects/midpoint'
import { useActionTransition } from '@/hooks/use-action-transition'
import { cn } from '@/lib/utils'

export type ReorderableNoteT = { id: string; title: string; position: number }

function SortableRow({ id, title }: { id: string; title: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'bg-card flex cursor-grab items-center gap-2 rounded-md border px-3 py-2 text-sm select-none',
        isDragging && 'opacity-60',
      )}
      {...attributes}
      {...listeners}
    >
      <span className="text-muted-foreground" aria-hidden>
        ⠿
      </span>
      <span className="truncate">{title}</span>
    </li>
  )
}

// Lightweight reorderable table-of-contents (titles only) for a subject's notes. The heavy
// Shiki-rendered document stays a server component below this island. A drag optimistically
// reorders local state and writes the moved row's new fractional position via reorderNote;
// a failure reverts and surfaces the error. Renders nothing for <2 notes (nothing to order).
export function ReorderableNoteList({ notes }: { notes: ReorderableNoteT[] }) {
  const [items, setItems] = useState(notes)
  const { error, run } = useActionTransition()
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)
    const position = midpoint(
      reordered[newIndex - 1]?.position,
      reordered[newIndex + 1]?.position,
      items[oldIndex].position,
    )
    reordered[newIndex] = { ...reordered[newIndex], position }

    // Optimistic: apply locally, then revert if the write fails. The hook owns the error toast +
    // inline error; only the local-state rollback stays here (it owns `items`, the hook can't).
    const previous = items
    setItems(reordered)
    const result = await run(() => reorderNote(reordered[newIndex].id, position), {
      successMessage: 'Order saved',
    })
    if (!result.success) setItems(previous)
  }

  if (items.length < 2) return null

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs">Drag to reorder</p>
      <DndContext
        id="subject-note-reorder"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1">
            {items.map((i) => (
              <SortableRow key={i.id} id={i.id} title={i.title} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <FormError message={error} />
    </div>
  )
}
