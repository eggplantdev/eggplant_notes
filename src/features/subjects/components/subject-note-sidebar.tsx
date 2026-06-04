'use client'

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ListIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type KeyboardEvent } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { reorderNote } from '@/features/subjects/actions/reorder-note'
import { midpoint } from '@/features/subjects/midpoint'
import { useActionTransition } from '@/hooks/use-action-transition'
import { cn } from '@/lib/utils'

export type NoteSummaryT = { id: string; title: string | null; position: number | null }

// Arrow ↑/↓ moves focus between note links within the same list, so keyboard users browse notes
// without tabbing through every grip. Scoped to the current <ul> (closest) so the desktop column
// and the mobile sheet never cross-focus each other.
function handleNoteLinkKeyNav(e: KeyboardEvent<HTMLAnchorElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  e.preventDefault()
  const links = Array.from(
    e.currentTarget.closest('ul')?.querySelectorAll<HTMLAnchorElement>('a[data-note-link]') ?? [],
  )
  const i = links.indexOf(e.currentTarget)
  const next = e.key === 'ArrowDown' ? links[i + 1] : links[i - 1]
  next?.focus()
}

// A single sidebar row: the body is a navigation Link (swap the active note); the grip is a
// mouse-only drag handle (NOT keyboard-focusable — `tabIndex=-1`, no dnd `attributes`/KeyboardSensor)
// so keyboard nav is one Tab stop per row (the link) + arrow keys, not a grip→link two-step. The
// useSortable node stays the <li> (measured by verticalListSortingStrategy); only pointer `listeners`
// live on the grip. Keyboard reorder is intentionally dropped here — the continuous-view ToC keeps it.
function SortableNoteRow({
  subjectId,
  id,
  title,
  isActive,
  onNavigate,
}: {
  subjectId: string
  id: string
  title: string | null
  isActive: boolean
  onNavigate?: () => void
}) {
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
      <Link
        href={`/subjects/${subjectId}/${id}`}
        aria-current={isActive ? 'page' : undefined}
        onClick={onNavigate}
        onKeyDown={handleNoteLinkKeyNav}
        data-note-link
        className={cn(
          'focus-visible:ring-ring min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none',
          isActive ? 'bg-muted font-medium' : 'hover:bg-muted',
        )}
      >
        {title ?? 'Untitled'}
      </Link>
    </li>
  )
}

function SortableNoteList({
  dndId,
  subjectId,
  items,
  activeNoteId,
  onDragEnd,
  onNavigate,
}: {
  dndId: string
  subjectId: string
  items: NoteSummaryT[]
  activeNoteId: string | undefined
  onDragEnd: (event: DragEndEvent) => void
  onNavigate?: () => void
}) {
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

// Docs-view sidebar (S-15): persistent list of a subject's notes — each row navigates (Link)
// and reorders (grip handle). Desktop renders as a column; mobile collapses behind a sheet
// trigger (mirrors the S-10 app-nav pattern). Optimistic `items` state is lifted here so the
// desktop column and the mobile sheet share one source of truth; a drag writes the moved row's
// new fractional position via reorderNote and reverts on failure. Always renders the list (even
// for <2 notes) — it's a nav surface, not only a reorder control.
export function SubjectNoteSidebar({
  subjectId,
  notes,
}: {
  subjectId: string
  notes: NoteSummaryT[]
}) {
  const [items, setItems] = useState(notes)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { error, run } = useActionTransition()
  const pathname = usePathname()
  const prefix = `/subjects/${subjectId}/`
  const activeNoteId = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : undefined

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)
    const position = midpoint(
      reordered[newIndex - 1]?.position ?? undefined,
      reordered[newIndex + 1]?.position ?? undefined,
      items[oldIndex].position ?? 0,
    )
    reordered[newIndex] = { ...reordered[newIndex], position }

    const previous = items
    setItems(reordered)
    const result = await run(() => reorderNote(reordered[newIndex].id, position), {
      successMessage: 'Order saved',
    })
    if (!result.success) setItems(previous)
  }

  return (
    <>
      {/* Desktop: persistent sidebar column — sticky below the nav bar, scrolls on its own when
          the note list is long so the content pane scrolls independently. */}
      <nav
        aria-label="Notes in this subject"
        className="hidden md:sticky md:top-20 md:block md:max-h-[calc(100dvh-6rem)] md:overflow-y-auto"
      >
        <SortableNoteList
          dndId="subject-sidebar-desktop"
          subjectId={subjectId}
          items={items}
          activeNoteId={activeNoteId}
          onDragEnd={handleDragEnd}
        />
        <FormError message={error} />
      </nav>

      {/* Mobile: a trigger that opens the same list in a sheet. */}
      <div className="md:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <ListIcon /> Notes
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="bg-background flex w-72 flex-col">
            <SheetTitle className="px-4 pt-4">Notes in this subject</SheetTitle>
            <nav aria-label="Notes in this subject" className="flex-1 overflow-y-auto p-4">
              <SortableNoteList
                dndId="subject-sidebar-mobile"
                subjectId={subjectId}
                items={items}
                activeNoteId={activeNoteId}
                onDragEnd={handleDragEnd}
                onNavigate={() => setSheetOpen(false)}
              />
              <FormError message={error} />
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
