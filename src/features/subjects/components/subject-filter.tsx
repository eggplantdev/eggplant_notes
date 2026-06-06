'use client'

import { X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { MultiSelect, type MultiSelectOptionT } from '@/components/ui/multi-select'
import { buildUrlWithParams } from '@/lib/utils/build-url-with-params'

// Batch rapid toggles into one server round-trip: a popover session re-queries on the trailing
// edge, not once per click.
const DEBOUNCE_MS = 400

type SubjectFilterPropsT = {
  options: MultiSelectOptionT[]
  // Subject ids currently in the URL (`?subjects=a,b`) — server-derived, the source of truth.
  selectedIds: string[]
}

// Shared subject ("topic") filter; selection lives in the URL so it's shareable and scales past
// the loaded set. Two-mode selection avoids a desync: while OPEN, `localSelected` drives so
// toggles feel instant and the debounce can batch them; while CLOSED, it's null and selection
// derives straight from the URL prop — so Back/Forward and external edits stay in sync without a
// second source of truth.
export function SubjectFilter({ options, selectedIds }: SubjectFilterPropsT) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [localSelected, setLocalSelected] = useState<string[] | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selected = localSelected ?? selectedIds

  function commit(next: string[]) {
    // buildUrlWithParams deletes empty-string keys: empty selection clears `subjects`, and
    // `page: ''` resets to page 1 (else a subject change strands on a now-empty deep page).
    const url = buildUrlWithParams(pathname, searchParams.toString(), {
      subjects: next.join(','),
      page: '',
    })
    startTransition(() => router.replace(url, { scroll: false }))
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

  // Remove a chip. While the popover is open we stay in localSelected/debounce mode; while it's
  // closed we commit straight to the URL (no debounce) so the change isn't held by a timer that
  // only flushes on popover close.
  function handleRemove(id: string) {
    const next = selected.filter((value) => value !== id)
    if (open) handleChange(next)
    else commit(next)
  }

  const labelFor = (id: string) => options.find((option) => option.value === id)?.label ?? id

  // Cleanup only: clear a pending timer if we unmount mid-debounce so it can't fire (and
  // router.replace) from a dead component. Not derived-state-in-effect — the pattern the
  // project's "avoid useEffect" rule targets — just imperative-timer teardown.
  useEffect(() => () => clearTimeout(timer.current ?? undefined), [])

  return (
    <div className="flex flex-col gap-2">
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

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selected.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => handleRemove(id)}
                aria-label={`Remove ${labelFor(id)}`}
                className="bg-muted text-foreground hover:bg-muted/70 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
              >
                <span className="line-clamp-1 max-w-40">{labelFor(id)}</span>
                <X className="size-3 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
