'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { MultiSelect, type MultiSelectOptionT } from '@/components/ui/multi-select'

// Batch rapid toggles into one server round-trip: picking several subjects in a single popover
// session re-queries getNotes once on the trailing edge, not once per click (mirrors
// wykonczymy's FilterMultiSelect). The transition keeps the list interactive during the
// re-query.
const DEBOUNCE_MS = 400

type NotesFilterPropsT = {
  options: MultiSelectOptionT[]
  // Subject ids currently in the URL (`?subjects=a,b`) — server-derived, the source of truth.
  selectedIds: string[]
}

// Subject ("topic") filter for the notes list. Server-side: the selection lives in the URL and
// NotesPage re-queries getNotes({ subjectIds }) on change, so the filter is shareable and
// scales past the loaded set. Two-mode selection avoids a desync: while the popover is OPEN,
// `localSelected` drives so toggles feel instant and the debounce can batch them; while CLOSED,
// it's null and selection derives straight from the URL prop — so Back/Forward and external
// edits stay in sync without a second source of truth. Opening reseeds from the URL; closing
// flushes any pending debounce immediately.
export function NotesFilter({ options, selectedIds }: NotesFilterPropsT) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [localSelected, setLocalSelected] = useState<string[] | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selected = localSelected ?? selectedIds

  function commit(next: string[]) {
    const params = new URLSearchParams(searchParams.toString())
    if (next.length > 0) params.set('subjects', next.join(','))
    else params.delete('subjects')
    const qs = params.toString()
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }

  function scheduleCommit(next: string[]) {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      commit(next)
      timer.current = null
    }, DEBOUNCE_MS)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setLocalSelected(selectedIds) // reseed from the URL each time we open
      setOpen(true)
      return
    }
    // Closing: flush a pending debounce now so nothing is lost, then hand control back to the
    // URL prop (localSelected = null).
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
      if (localSelected) commit(localSelected)
    }
    setLocalSelected(null)
    setOpen(false)
  }

  function handleChange(next: string[]) {
    setLocalSelected(next)
    scheduleCommit(next)
  }

  // Cleanup only: clear a pending timer if we unmount mid-debounce so it can't fire (and
  // router.replace) from a dead component. Not derived-state-in-effect — the pattern the
  // project's "avoid useEffect" rule targets — just imperative-timer teardown.
  useEffect(() => () => clearTimeout(timer.current ?? undefined), [])

  return (
    <MultiSelect
      open={open}
      onOpenChange={handleOpenChange}
      options={options}
      values={selected}
      onValuesChange={handleChange}
      placeholder="Subjects"
      searchPlaceholder="Search subjects…"
      emptyMessage="No subjects found."
      className="w-full sm:w-64"
    />
  )
}
