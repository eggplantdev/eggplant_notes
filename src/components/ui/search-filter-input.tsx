'use client'

import { Search } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// Debounce each keystroke into one trailing server re-query (matches SubjectFilter's DEBOUNCE_MS),
// so typing a word fires one navigation, not one per character.
const DEBOUNCE_MS = 400

type SearchFilterInputPropsT = {
  placeholder?: string
  className?: string
}

// Self-contained, URL-driven search box for the paginated list pages. Writes `?q=` via
// router.replace({ scroll: false }) inside a transition so the list stays interactive during the
// re-query. Deletes `page` on every commit — changing the query must reset to page 1, else the user
// is stranded on a now-out-of-range deep page (the cross-component page-reset invariant;
// SubjectFilter does the same on its commit).
//
// Two-mode (mirrors SubjectFilter): while FOCUSED, `local` drives so keystrokes are instant and the
// debounce can batch them; while BLURRED it's null and the value derives straight from the URL — so
// Back/Forward and a cleared filter stay in sync without a resync effect (the project's
// "avoid useEffect / no setState-in-effect" rule). On blur a pending debounce is flushed so the last
// keystrokes aren't lost.
export function SearchFilterInput({ placeholder = 'Search…', className }: SearchFilterInputPropsT) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const urlQuery = searchParams.get('q') ?? ''
  const [local, setLocal] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const value = local ?? urlQuery

  function commit(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    const trimmed = next.trim()
    if (trimmed) params.set('q', trimmed)
    else params.delete('q')
    params.delete('page') // a query change always returns to page 1
    const qs = params.toString()
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }

  function scheduleCommit(next: string) {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      commit(next)
      timer.current = null
    }, DEBOUNCE_MS)
  }

  function handleChange(next: string) {
    setLocal(next)
    scheduleCommit(next)
  }

  function handleBlur() {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
      if (local !== null) commit(local)
    }
    setLocal(null) // hand control back to the URL prop
  }

  // Cleanup-only timer teardown — clear a pending debounce on unmount so it can't router.replace
  // from a dead component (same teardown pattern as SubjectFilter; no setState, so not the banned
  // derived-state effect).
  useEffect(() => () => clearTimeout(timer.current ?? undefined), [])

  return (
    <div className={cn('relative', className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        type="search"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="h-8 w-full pl-8 text-sm sm:w-64"
      />
    </div>
  )
}
