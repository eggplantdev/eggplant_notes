import type { DueCardT } from '@/features/memory-cards/types'
import { REVIEW_PANEL_ID } from '@/features/review/constants'
import { ReviewCardTransition } from '@/features/review/components/review-card-transition'
import { ReviewPanel } from '@/features/review/components/review-panel'

type PropsT = {
  // The resolved card to show (clicked → soonest-due → soonest overall). undefined ⟺ no card matches
  // the active filters (empty deck) → render nothing; the list's own empty state shows below instead.
  card: DueCardT | undefined
  goal: number
  reviewingAhead: boolean
  advanceHref?: string
  // Scroll the panel into view on mount — only when the user explicitly clicked a `?review` card.
  scrollOnMount: boolean
}

// The /memory-cards review area — the empty-deck gate + the ReviewPanel/ReviewCardTransition JSX,
// extracted from the page. Presentational: the page resolves the card and passes it in, so this
// stays render-only (no data fetching, not streamed — it's primary content).
export function ReviewPanelSection({
  card,
  goal,
  reviewingAhead,
  advanceHref,
  scrollOnMount,
}: PropsT) {
  if (!card) return null

  return (
    <div id={REVIEW_PANEL_ID} className="mx-auto w-full max-w-3xl scroll-mt-24">
      <ReviewCardTransition cardKey={card.id} scrollOnMount={scrollOnMount}>
        <ReviewPanel
          card={card}
          goal={goal}
          showCardControls
          advanceHref={advanceHref}
          reviewingAhead={reviewingAhead}
        />
      </ReviewCardTransition>
    </div>
  )
}
