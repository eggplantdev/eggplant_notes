'use client'

import { type DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { ListIcon } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { reorderNote } from '@/features/subjects/actions/reorder-note'
import { FilteredNoteList } from '@/features/subjects/components/filtered-note-list'
import { SidebarFilter } from '@/features/subjects/components/sidebar-filter'
import { SortableNoteList } from '@/features/subjects/components/sortable-note-list'
import { midpoint } from '@/features/subjects/utils/midpoint'
import type { SubjectNoteSummaryT } from '@/features/subjects/types'
import { useActionTransition } from '@/hooks/use-action-transition'

type SubjectNoteSidebarPropsT = {
  subjectId: string
  notes: SubjectNoteSummaryT[]
}

// Optimistic `items` state is lifted here so the desktop column and the mobile sheet share one
// source of truth; a drag writes the moved row's new fractional position via reorderNote and
// reverts on failure. Title filter is client-side (no URL): the full summary set is already
// loaded, so filtering in-memory is instant — and the host layout can't read searchParams anyway.
// A non-empty term switches to the static list (drag off, see FilteredNoteList).
export function SubjectNoteSidebar({ subjectId, notes }: SubjectNoteSidebarPropsT) {
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

  // The bottom fade is a scroll affordance — show it only when the list actually overflows its
  // scroll box, otherwise a single short note gets a fade under it (nothing to scroll to). CSS
  // can't distinguish overflowing from not, so we measure: re-run on list changes (React-driven)
  // and on viewport/flex resize (ResizeObserver). +1 guards sub-pixel rounding.
  const navRef = useRef<HTMLElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const measure = () => setIsOverflowing(el.scrollHeight > el.clientHeight + 1)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [items, visible, filtering])

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
        ref={navRef}
        aria-label="Notes in this subject"
        className="hidden md:block md:min-h-0 md:flex-1 md:overflow-y-auto"
      >
        <SidebarFilter value={term} onChange={setTerm} />
        {renderList('subject-sidebar-desktop')}
        <FormError message={error} />
      </nav>
      {/* Pins to the layout's `relative` wrapper (outside this scrolling nav) so the fade stays at
          the viewport edge instead of scrolling away. Only when the list overflows — see above. */}
      {isOverflowing && (
        <div className="from-background pointer-events-none absolute inset-x-0 bottom-0 hidden h-4 bg-gradient-to-t from-40% to-transparent md:block" />
      )}

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
