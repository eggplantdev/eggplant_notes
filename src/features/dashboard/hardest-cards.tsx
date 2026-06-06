import Link from 'next/link'

import { MutedText } from '@/components/ui/muted-text'
import type { HardestCardT } from '@/features/dashboard/types'

type PropsT = { cards: HardestCardT[] }

// "Needs attention" list: the most-lapsed cards, each linking to its source note (S-08 path).
export function HardestCards({ cards }: PropsT) {
  if (cards.length === 0) {
    return <MutedText>No lapsed cards yet — nothing struggling.</MutedText>
  }
  return (
    <ul className="divide-border divide-y">
      {cards.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-3 py-2">
          {c.noteId ? (
            // Linked card: the row deep-links to its source note.
            <Link href={`/notes/${c.noteId}`} className="min-w-0 hover:underline">
              <p className="text-foreground truncate text-sm font-medium">{c.prompt}</p>
              <MutedText size="xs" truncate>
                {c.noteTitle}
              </MutedText>
            </Link>
          ) : (
            // Standalone card: no source note, so render a plain (non-link) title.
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-medium">{c.prompt}</p>
              <MutedText size="xs" truncate>
                {c.noteTitle}
              </MutedText>
            </div>
          )}
          <span className="text-destructive shrink-0 text-xs font-medium tabular-nums">
            {c.lapses} {c.lapses === 1 ? 'lapse' : 'lapses'}
          </span>
        </li>
      ))}
    </ul>
  )
}
