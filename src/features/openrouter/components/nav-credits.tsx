import { Wallet } from 'lucide-react'

import { getOpenRouterCredits } from '@/features/openrouter/credits'

const usd = (n: number) => `$${n.toFixed(2)}`

// Async server component: shows the caller's remaining OpenRouter balance in the nav. Self-fetches so
// the parent nav doesn't block on it — render inside <Suspense> to stream it in. Renders nothing when
// the wallet can't be read (disconnected / OpenRouter unreachable), so it never shows a broken state.
export async function NavCredits() {
  const credits = await getOpenRouterCredits()
  if (!credits) return null

  return (
    <span
      className="text-muted-foreground inline-flex items-center gap-1.5 text-sm tabular-nums"
      title={`OpenRouter: ${usd(credits.used)} used of ${usd(credits.total)}`}
      data-testid="nav-openrouter-credits"
    >
      <Wallet className="size-4" />
      {usd(credits.remaining)}
    </span>
  )
}
