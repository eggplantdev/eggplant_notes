'use client'

import { AnimatedCardList } from '@/components/motion/animated-card-list'
import { ButtonLink } from '@/components/ui/button-link'
import {
  renderCardEyebrow,
  renderCardSubtitle,
  renderCardTitle,
} from '@/features/memory-cards/components/memory-card-cells'
import type { MemoryCardListItemT } from '@/features/memory-cards/types'

// The dashboard's read-only preview of the soonest-due card: the exact /memory-cards listing card
// body (eyebrow + prompt + subject/note), but with a gradient border and a single Review action that
// links out to /memory-cards (where reviewing actually happens) instead of the listing's
// Edit/Link/Delete controls. Single item, so the default vertical layout fills its container.
export function DueCardPreview({ card }: { card: MemoryCardListItemT }) {
  return (
    <AnimatedCardList
      items={[card]}
      getKey={(c) => c.id}
      getItemClassName={() => 'gradient-border ring-0'}
      renderEyebrow={renderCardEyebrow}
      renderTitle={renderCardTitle}
      renderSubtitle={renderCardSubtitle}
      renderAction={() => (
        <ButtonLink href="/memory-cards" variant="outline" size="sm">
          Review
        </ButtonLink>
      )}
    />
  )
}
