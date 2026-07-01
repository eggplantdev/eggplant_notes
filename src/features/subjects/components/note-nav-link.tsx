'use client'

import Link from 'next/link'
import { type KeyboardEvent } from 'react'

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

type NoteNavLinkPropsT = {
  subjectId: string
  id: string
  title: string | null
  isActive: boolean
  onNavigate?: () => void
}

export function NoteNavLink({ subjectId, id, title, isActive, onNavigate }: NoteNavLinkPropsT) {
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
