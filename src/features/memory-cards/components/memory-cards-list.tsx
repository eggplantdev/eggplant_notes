'use client'

import { AnimatedCardList } from '@/components/motion/animated-card-list'
import { CardActions } from '@/components/ui/card-actions'
import { DeleteMemoryCardButton } from '@/features/memory-cards/delete-memory-card-button'
import type { MemoryCardListItemT } from '@/features/memory-cards/types'
import { formatReviewStatus, memoryCardEditHref } from '@/features/memory-cards/utils'

// Thin client wrapper over the shared AnimatedCardList: supplies the memory-card card href, the
// prompt as the title, a review-status eyebrow, and a subtitle of the subject ("topic") chip +
// source-note title. Data is fetched on the server (MemoryCardsPage) and passed in; this stays a
// client component only so it can hand render functions to the list. Unlike NotesList there are no
// per-card actions — editing/deleting a card lives on the note detail. The card→note href deep-
// links to the exact card (`#card-<id>`), the card→note differentiator.
export function MemoryCardsList({ cards }: { cards: MemoryCardListItemT[] }) {
  return (
    <AnimatedCardList
      gridLayout
      items={cards}
      getKey={(card) => card.id}
      getHref={(card) => `/notes/${card.note_id}#card-${card.id}`}
      renderAction={(card) =>
        // Phase 1: every card still has a note, so guarding on note_id is behavior-preserving and
        // narrows the now-nullable column to string. Phase 2/3 repoint edit + handle note-less cards.
        card.note_id ? (
          <CardActions
            editHref={memoryCardEditHref(card.id)}
            deleteControl={<DeleteMemoryCardButton noteId={card.note_id} id={card.id} />}
          />
        ) : null
      }
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
