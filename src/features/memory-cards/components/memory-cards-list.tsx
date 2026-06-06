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

// Thin client wrapper over the shared AnimatedCardList: supplies the memory-card card href, the
// prompt as the title, a review-status eyebrow, and a subtitle of the subject ("topic") chip +
// source-note title. Data is fetched on the server (MemoryCardsPage) and passed in; this stays a
// client component only so it can hand render functions to the list.
export function MemoryCardsList({ cards }: { cards: MemoryCardListItemT[] }) {
  return (
    <AnimatedCardList
      gridLayout
      items={cards}
      getKey={(card) => card.id}
      // Every card — linked or standalone — opens its on-demand review page (memory-card-review-page);
      // the per-row Edit button still reaches the edit page.
      getHref={(card) => memoryCardHref(card.id)}
      // Edit + Delete render for EVERY card (route-based edit; delete works with or without a note).
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
