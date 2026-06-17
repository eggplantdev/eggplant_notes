'use client'

import { AnimatedCardList } from '@/components/motion/animated-card-list'
import { CardActions } from '@/components/ui/card-actions'
import { DeleteMemoryCardButton } from '@/features/memory-cards/components/delete-memory-card-button'
import { LinkCardButton } from '@/features/memory-cards/components/link-card-button'
import {
  renderCardEyebrow,
  renderCardSubtitle,
  renderCardTitle,
} from '@/features/memory-cards/components/memory-card-cells'
import { ReviewCardButton } from '@/features/memory-cards/components/review-card-button'
import type { MemoryCardListItemT } from '@/features/memory-cards/types'
import { memoryCardEditHref } from '@/features/memory-cards/utils'
import type { SubjectOptionT } from '@/features/subjects/types'

// Thin client wrapper over the shared AnimatedCardList — client only so it can hand render
// functions to the list; data is fetched on the server and passed in. `subjects` feeds the per-row
// Link dialog (shown only for unlinked cards). No card-body link: the whole card no longer
// navigates — the per-card Review button selects it for the in-place panel instead.
export function MemoryCardsList({
  cards,
  subjects,
}: {
  cards: MemoryCardListItemT[]
  subjects: SubjectOptionT[]
}) {
  return (
    <AnimatedCardList
      gridLayout
      items={cards}
      getKey={(card) => card.id}
      renderAction={(card) => (
        <CardActions
          editHref={memoryCardEditHref(card.id)}
          reviewControl={<ReviewCardButton id={card.id} />}
          linkControl={
            card.note_id ? undefined : (
              <LinkCardButton
                cardId={card.id}
                cardSubjectId={card.subject_id}
                subjects={subjects}
              />
            )
          }
          deleteControl={<DeleteMemoryCardButton id={card.id} noteId={card.note_id ?? undefined} />}
        />
      )}
      renderTitle={renderCardTitle}
      renderEyebrow={renderCardEyebrow}
      renderSubtitle={renderCardSubtitle}
    />
  )
}
