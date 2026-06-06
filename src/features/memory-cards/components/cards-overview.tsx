import { InfoTip } from '@/components/ui/info-tip'
import { CardsByMaturityChart } from '@/features/memory-cards/components/cards-by-maturity-chart'
import { CardsByStateChart } from '@/features/memory-cards/components/cards-by-state-chart'
import { MATURE_STABILITY_DAYS } from '@/features/memory-cards/constants'
import type { MemoryCardListItemT } from '@/features/memory-cards/types'

type PropsT = { cards: MemoryCardListItemT[] }

// Aggregate view over the (subject-filtered) card set rendered on this page. Two distinct axes,
// each its own radial chart: the FSRS state mix (New/Learning/Review/Relearning) and the
// maturity split (stability ≥ MATURE_STABILITY_DAYS). Reflects the active filter, since `cards`
// is the post-filter list.
export function CardsOverview({ cards }: PropsT) {
  const stateCounts = [0, 0, 0, 0]
  let mature = 0
  for (const c of cards) {
    if (c.state >= 0 && c.state < stateCounts.length) stateCounts[c.state] += 1
    if (c.stability >= MATURE_STABILITY_DAYS) mature += 1
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          By state
        </p>
        <CardsByStateChart stateCounts={stateCounts} />
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
          By maturity
          <InfoTip label="What do Mature and Young mean?">
            <span className="flex flex-col gap-1 font-normal normal-case">
              <span>How well each card has stuck in your memory:</span>
              <span>
                <strong>Young</strong> — still learning it, so it comes back often.
              </span>
              <span>
                <strong>Mature</strong> — you know it well, so it only returns every few weeks.
              </span>
            </span>
          </InfoTip>
        </p>
        <CardsByMaturityChart mature={mature} young={cards.length - mature} />
      </div>
    </div>
  )
}
