import Link from 'next/link'

import type { HardestCardT } from '@/features/dashboard/types'

type PropsT = { cards: HardestCardT[] }

// "Needs attention" list: the most-lapsed cards, each linking to its source note (S-08 path).
export function HardestCards({ cards }: PropsT) {
  if (cards.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No lapsed cards yet — nothing struggling.</p>
    )
  }
  return (
    <ul className="divide-border divide-y">
      {cards.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-3 py-2">
          <Link href={`/notes/${c.noteId}`} className="min-w-0 hover:underline">
            <p className="text-foreground truncate text-sm font-medium">{c.prompt}</p>
            <p className="text-muted-foreground truncate text-xs">{c.noteTitle}</p>
          </Link>
          <span className="text-destructive shrink-0 text-xs font-medium tabular-nums">
            {c.lapses} {c.lapses === 1 ? 'lapse' : 'lapses'}
          </span>
        </li>
      ))}
    </ul>
  )
}
