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
import { GripVertical, ListIcon, Search } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type KeyboardEvent } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { reorderNote } from '@/features/subjects/actions/reorder-note'
import { midpoint } from '@/features/subjects/utils/midpoint'
import type { SubjectNoteSummaryT } from '@/features/subjects/types'
import { useActionTransition } from '@/hooks/use-action-transition'
import { cn } from '@/lib/utils'

// Arrow ↑/↓ moves focus between note links in the same list so keyboard users browse without
// tabbing through every grip. Scoped to the current <ul> so desktop column and mobile sheet
// don't cross-focus.
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

function NoteNavLink({
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
  return (
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
  )
}

// The grip is a mouse-only drag handle (NOT keyboard-focusable — `tabIndex=-1`, no dnd
// `attributes`/KeyboardSensor) so keyboard nav is one Tab stop per row (the link) + arrow keys,
// not a grip→link two-step. Keyboard reorder is intentionally dropped here; the continuous-view
// ToC keeps it.
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
  items: SubjectNoteSummaryT[]
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

// Reorder is intentionally OFF while filtering: dragging a filtered SUBSET would compute
// fractional positions against the wrong neighbors (the hidden rows between two visible ones),
// so the only coherent options are full-list-draggable OR filtered-static.
function FilteredNoteList({
  subjectId,
  items,
  activeNoteId,
  onNavigate,
}: {
  subjectId: string
  items: SubjectNoteSummaryT[]
  activeNoteId: string | undefined
  onNavigate?: () => void
}) {
  return (
    <ul className="flex flex-col gap-0.5 pl-1">
      {items.map((i) => (
        <li key={i.id} className="flex items-center">
          <NoteNavLink
            subjectId={subjectId}
            id={i.id}
            title={i.title}
            isActive={i.id === activeNoteId}
            onNavigate={onNavigate}
          />
        </li>
      ))}
    </ul>
  )
}

function SidebarFilter({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <div className="relative mb-2">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter notes…"
        className="text-control h-7 w-full pl-8"
      />
    </div>
  )
}

// Optimistic `items` state is lifted here so the desktop column and the mobile sheet share one
// source of truth; a drag writes the moved row's new fractional position via reorderNote and
// reverts on failure. Title filter is client-side (no URL): the full summary set is already
// loaded, so filtering in-memory is instant — and the host layout can't read searchParams anyway.
// A non-empty term switches to the static list (drag off, see FilteredNoteList).
export function SubjectNoteSidebar({
  subjectId,
  notes,
}: {
  subjectId: string
  notes: SubjectNoteSummaryT[]
}) {
  const [items, setItems] = useState(notes)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [term, setTerm] = useState('')
  const { error, run } = useActionTransition()
  const pathname = usePathname()
  const prefix = `/subjects/${subjectId}/`
  const activeNoteId = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : undefined

  const trimmed = term.trim().toLowerCase()
  const filtering = trimmed.length > 0
  const visible = filtering
    ? items.filter((i) => (i.title ?? '').toLowerCase().includes(trimmed))
    : items

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

  function renderList(dndId: string, onNavigate?: () => void) {
    if (filtering) {
      if (visible.length === 0) {
        return <p className="text-muted-foreground px-2 py-1.5 text-sm">No notes match.</p>
      }
      return (
        <FilteredNoteList
          subjectId={subjectId}
          items={visible}
          activeNoteId={activeNoteId}
          onNavigate={onNavigate}
        />
      )
    }
    return (
      <SortableNoteList
        dndId={dndId}
        subjectId={subjectId}
        items={items}
        activeNoteId={activeNoteId}
        onDragEnd={handleDragEnd}
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <>
      {/* The layout wraps this in a flex column (add-note button + this nav); md:flex-1 makes the
          nav fill the remaining height and scroll its own list when long — the content pane and
          page stay put. */}
      <nav
        aria-label="Notes in this subject"
        className="hidden md:block md:min-h-0 md:flex-1 md:overflow-y-auto"
      >
        <SidebarFilter value={term} onChange={setTerm} />
        {renderList('subject-sidebar-desktop')}
        <FormError message={error} />
      </nav>

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
              <SidebarFilter value={term} onChange={setTerm} />
              {renderList('subject-sidebar-mobile', () => setSheetOpen(false))}
              <FormError message={error} />
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
