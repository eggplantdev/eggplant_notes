'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { MultiSelect, type MultiSelectOptionT } from '@/components/ui/multi-select'
import { Pill } from '@/components/ui/pill'
import { buildUrlWithParams } from '@/lib/utils/build-url-with-params'

// Batch rapid toggles into one server round-trip: a popover session re-queries on the trailing
// edge, not once per click.
const DEBOUNCE_MS = 400

type UrlMultiSelectFilterPropsT = {
  // The URL query-param key this filter owns (e.g. `subjects`, `state`, `maturity`).
  paramKey: string
  options: readonly MultiSelectOptionT[]
  // Values currently in the URL (`?<paramKey>=a,b`) — server-derived, the source of truth.
  selectedValues: string[]
  placeholder?: string
  searchable?: boolean
  searchPlaceholder?: string
  emptyMessage?: string
  // Trigger width; defaults to the standalone filter width. A parent grid passes `w-full` to fill its cell.
  triggerClassName?: string
}

// Generic URL-driven multiselect filter; selection lives in the URL so it's shareable and scales
// past the loaded set. Two-mode selection avoids a desync: while OPEN, `localSelected` drives so
// toggles feel instant and the debounce can batch them; while CLOSED, it's null and selection
// derives straight from the URL prop — so Back/Forward and external edits stay in sync without a
// second source of truth.
export function UrlMultiSelectFilter({
  paramKey,
  options,
  selectedValues,
  placeholder,
  searchable,
  searchPlaceholder,
  emptyMessage,
  triggerClassName = 'w-full sm:w-64',
}: UrlMultiSelectFilterPropsT) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [localSelected, setLocalSelected] = useState<string[] | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selected = localSelected ?? selectedValues

  function commit(next: string[]) {
    // buildUrlWithParams deletes empty-string keys: empty selection clears `paramKey`, and
    // `page: ''` resets to page 1 (else a filter change strands on a now-empty deep page).
    const url = buildUrlWithParams(pathname, searchParams.toString(), {
      [paramKey]: next.join(','),
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
      setLocalSelected(selectedValues)
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
  function handleRemove(value: string) {
    const next = selected.filter((v) => v !== value)
    if (open) handleChange(next)
    else commit(next)
  }

  const labelFor = (value: string) =>
    options.find((option) => option.value === value)?.label ?? value

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
        placeholder={placeholder}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        emptyMessage={emptyMessage}
        className={triggerClassName}
        data-testid={`filter-${paramKey}`}
      />

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selected.map((value) => (
            <li key={value}>
              <Pill onRemove={() => handleRemove(value)} removeLabel={`Remove ${labelFor(value)}`}>
                {labelFor(value)}
              </Pill>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
