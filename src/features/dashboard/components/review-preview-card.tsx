import { Card, CardContent } from '@/components/ui/card'
import { DueCardPreview } from '@/features/memory-cards/components/due-card-preview'
import type { MemoryCardListItemT } from '@/features/memory-cards/types'
import { CaughtUpNotice } from '@/features/review/components/caught-up-notice'

// Read-only review section on the dashboard. Reviewing itself moved to /memory-cards, so a due card
// is shown as the listing-style preview card (Review links out) and an empty queue shows the
// caught-up note — both in a gradient-bordered card.
export function ReviewPreviewCard({ card }: { card: MemoryCardListItemT | undefined }) {
  if (!card) {
    return (
      <Card className="gradient-border ring-0">
        <CardContent>
          <CaughtUpNotice />
        </CardContent>
      </Card>
    )
  }

  return <DueCardPreview card={card} />
}
