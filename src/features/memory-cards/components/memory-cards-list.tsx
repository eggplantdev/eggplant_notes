'use client'

import { AnimatedCardList } from '@/components/motion/animated-card-list'
import { CardActions } from '@/components/ui/card-actions'
import { DeleteMemoryCardButton } from '@/features/memory-cards/delete-memory-card-button'
import type { MemoryCardListItemT } from '@/features/memory-cards/types'
import {
  formatReviewStatus,
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
        <span className="text-muted-foreground text-xs">{formatReviewStatus(card)}</span>
      )}
      renderSubtitle={(card) => (
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          {card.subjects?.title && (
            <span className="bg-muted text-foreground line-clamp-1 max-w-full rounded px-1.5 py-0.5 font-medium">
              {card.subjects.title}
            </span>
          )}
          {card.notes?.title && <span className="line-clamp-1">{card.notes.title}</span>}
        </div>
      )}
    />
  )
}
