'use client'

import { AnimatedCardList } from '@/components/motion/animated-card-list'
import { CardActions } from '@/components/ui/card-actions'
import { Pill } from '@/components/ui/pill'
import { cn } from '@/lib/utils'
import { DeleteMemoryCardButton } from '@/features/memory-cards/components/delete-memory-card-button'
import type { MemoryCardListItemT } from '@/features/memory-cards/types'
import {
  formatReviewStatus,
  isCardOverdue,
  memoryCardEditHref,
  memoryCardHref,
} from '@/features/memory-cards/utils'

// Thin client wrapper over the shared AnimatedCardList — client only so it can hand render
// functions to the list; data is fetched on the server and passed in.
export function MemoryCardsList({ cards }: { cards: MemoryCardListItemT[] }) {
  return (
    <AnimatedCardList
      gridLayout
      items={cards}
      getKey={(card) => card.id}
      getHref={(card) => memoryCardHref(card.id)}
      renderAction={(card) => (
        <CardActions
          editHref={memoryCardEditHref(card.id)}
          deleteControl={<DeleteMemoryCardButton id={card.id} noteId={card.note_id ?? undefined} />}
        />
      )}
      renderTitle={(card) => <span className="line-clamp-2">{card.prompt}</span>}
      renderEyebrow={(card) => (
        // Overdue cards color just the status text red as a gentle "act now" cue.
        <span
          className={cn(
            'text-xs',
            isCardOverdue(card) ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {formatReviewStatus(card)}
        </span>
      )}
      renderSubtitle={(card) => (
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          {card.subjects?.title && <Pill>{card.subjects.title}</Pill>}
          {card.notes?.title && <span className="line-clamp-1">{card.notes.title}</span>}
        </div>
      )}
    />
  )
}
