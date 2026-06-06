import { InfoTip } from '@/components/ui/info-tip'
import { CardsByMaturityChart } from '@/features/memory-cards/components/cards-by-maturity-chart'
import { CardsByStateChart } from '@/features/memory-cards/components/cards-by-state-chart'
import { MATURE_STABILITY_DAYS } from '@/features/memory-cards/constants'
import type { MemoryCardT } from '@/features/memory-cards/types'

type PropsT = { cards: Pick<MemoryCardT, 'state' | 'stability'>[] }

// Aggregate over the ENTIRE deck (getCardsForStats, not the paginated list — so it ignores
// `?q`/`?page`/`?subjects`). Two axes: the FSRS state mix and the maturity split.
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
