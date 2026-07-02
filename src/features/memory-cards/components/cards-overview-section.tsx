import { CardsOverview } from '@/features/memory-cards/components/cards-overview'
import { getCardOverview } from '@/features/memory-cards/queries'

// Fetches its own whole-deck overview so the page can stream it behind <Suspense> instead of
// blocking the review panel on the card_overview RPC (three full-deck aggregate scans). The panel is
// the interactive element; this decorative chart must not gate it. See memory-cards/page.tsx.
export async function CardsOverviewSection() {
  const overview = await getCardOverview()
  return <CardsOverview overview={overview} />
}
