import Link from 'next/link'

import { MutedText } from '@/components/ui/muted-text'
import type { HardestCardT } from '@/features/dashboard/types'
import { TitledCard } from '@/components/ui/titled-card'

type PropsT = { cards: HardestCardT[] }

export function HardestCards({ cards }: PropsT) {
  if (cards.length === 0) {
    return <MutedText>No lapsed cards yet — nothing struggling.</MutedText>
  }
  return (
    <TitledCard title="Needs attention">
      <ul className="divide-border divide-y">
        {cards.map((c) => (
          <li key={c.id}>
            {/* Whole row is the link (not just the text) so the entire item is a click target.
              Cross-page nav (dashboard → /memory-cards), so a plain Link, not the in-page
              ReviewCardButton (which needs the /memory-cards URL's own searchParams). The panel
              scrolls into view on arrival via ReviewCardTransition's scrollOnMount (?review=<id>) —
              no URL hash, which is unreliable in an installed PWA. */}
            <Link
              href={`/memory-cards?review=${c.id}`}
              className="hover:bg-muted/50 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm font-medium">{c.prompt}</p>
                <MutedText size="xs" truncate>
                  {c.noteTitle}
                </MutedText>
              </div>
              <span className="text-destructive shrink-0 text-xs font-medium tabular-nums">
                {c.lapses} {c.lapses === 1 ? 'lapse' : 'lapses'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </TitledCard>
  )
}
