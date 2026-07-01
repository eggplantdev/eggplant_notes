'use client'

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { SortableNoteRow } from '@/features/subjects/components/sortable-note-row'
import type { SubjectNoteSummaryT } from '@/features/subjects/types'

type SortableNoteListPropsT = {
  dndId: string
  subjectId: string
  items: SubjectNoteSummaryT[]
  activeNoteId: string | undefined
  onDragEnd: (event: DragEndEvent) => void
  onNavigate?: () => void
}

export function SortableNoteList({
  dndId,
  subjectId,
  items,
  activeNoteId,
  onDragEnd,
  onNavigate,
}: SortableNoteListPropsT) {
  const sensors = useSensors(useSensor(PointerSensor))
  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-0.5">
          {items.map((i) => (
            <SortableNoteRow
              key={i.id}
              subjectId={subjectId}
              id={i.id}
              title={i.title}
              isActive={i.id === activeNoteId}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
