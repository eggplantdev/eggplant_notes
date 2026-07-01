import Link from 'next/link'

import { MutedText } from '@/components/ui/muted-text'
import type { HardestCardT } from '@/features/dashboard/types'
import { REVIEW_PANEL_ID } from '@/features/review/constants'
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
          <li key={c.id} className="flex items-center justify-between gap-3 py-2">
            {/* Cross-page nav (dashboard → /memory-cards), so a plain Link + hash, not the in-page
              ReviewCardButton (which needs the /memory-cards URL's own searchParams). */}
            <Link
              href={`/memory-cards?review=${c.id}#${REVIEW_PANEL_ID}`}
              className="min-w-0 hover:underline"
            >
              <p className="text-foreground truncate text-sm font-medium">{c.prompt}</p>
              <MutedText size="xs" truncate>
                {c.noteTitle}
              </MutedText>
            </Link>
            <span className="text-destructive shrink-0 text-xs font-medium tabular-nums">
              {c.lapses} {c.lapses === 1 ? 'lapse' : 'lapses'}
            </span>
          </li>
        ))}
      </ul>
    </TitledCard>
  )
}
