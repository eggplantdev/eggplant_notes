'use client'

import { Loader2, Search } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { buildUrlWithParams } from '@/lib/utils/build-url-with-params'

// Debounce keystrokes into one trailing server re-query, so typing a word fires one navigation, not one per character.
const DEBOUNCE_MS = 400

type SearchFilterInputPropsT = {
  placeholder?: string
  className?: string
}

// URL-driven search box. Two-mode to avoid a resync effect: while focused `local` drives (instant,
// debounce-batched keystrokes); while blurred it's null and the value derives from the URL, so
// Back/Forward and a cleared filter stay in sync. Blur flushes a pending debounce so keystrokes aren't lost.
export function SearchFilterInput({ placeholder = 'Search…', className }: SearchFilterInputPropsT) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const urlQuery = searchParams.get('q') ?? ''
  const [local, setLocal] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const value = local ?? urlQuery
  // True from the first keystroke until the re-query's results render — the "searching" window the spinner marks.
  const isSearching = local !== null && local.trim() !== urlQuery

  function commit(next: string) {
    // `page: ''` resets to page 1 on every query change, else the user is stranded on an out-of-range deep page.
    const url = buildUrlWithParams(pathname, searchParams.toString(), {
      q: next.trim(),
      page: '',
    })
    startTransition(() => router.replace(url, { scroll: false }))
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
    setLocal(null)
  }

  // Cleanup-only: clear a pending debounce on unmount so it can't router.replace from a dead component.
  useEffect(() => () => clearTimeout(timer.current ?? undefined), [])

  return (
    <div className={cn('relative', className)}>
      {isSearching ? (
        <Loader2 className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2 animate-spin" />
      ) : (
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      )}
      <Input
        type="search"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="text-control h-7 w-full pl-8 sm:w-64"
      />
    </div>
  )
}
