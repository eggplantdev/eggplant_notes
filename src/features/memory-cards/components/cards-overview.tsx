import { InfoTip } from '@/components/ui/info-tip'
import { CardsByMaturityChart } from '@/features/memory-cards/components/cards-by-maturity-chart'
import { CardsByStateChart } from '@/features/memory-cards/components/cards-by-state-chart'
import { FSRS_STATE_LABELS } from '@/features/memory-cards/constants'
import type { CardOverviewT } from '@/features/memory-cards/types'

type PropsT = { overview: CardOverviewT }

// Whole-deck counts (card_overview RPC, not the paginated list — so it ignores `?q`/`?page`/
// `?subjects`). Two axes: the FSRS state mix and the maturity split. `byState` omits absent states,
// so zero-fill one slot per FSRS state (vocabulary single-sourced in FSRS_STATE_LABELS); young =
// everything not mature.
export function CardsOverview({ overview }: PropsT) {
  const stateCounts = FSRS_STATE_LABELS.map((_, state) => overview.byState[state] ?? 0)
  const mature = overview.mature

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
        <CardsByMaturityChart mature={mature} young={overview.total - mature} />
      </div>
    </div>
  )
}
