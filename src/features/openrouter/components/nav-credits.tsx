import { Button } from '@/components/ui/button'
import { getOpenRouterCredits } from '@/features/openrouter/credits'
import { cn } from '@/lib/utils'

const usd = (n: number) => `$${n.toFixed(2)}`

// Async server component: shows the caller's remaining OpenRouter balance in the nav. Self-fetches so
// the parent nav doesn't block on it — render inside <Suspense> to stream it in. Renders nothing when
// the wallet can't be read (disconnected / OpenRouter unreachable), so it never shows a broken state.
// Wears the `ai` button variant (gradient-border + fuchsia glow) so it reads as the same "magic"
// affordance as the Connect CTA it replaces once connected.
export async function NavCredits({ className }: { className?: string }) {
  const credits = await getOpenRouterCredits()
  if (!credits) return null

  return (
    <Button
      type="button"
      variant="ai"
      size="sm"
      className={cn('tabular-nums', className)}
      title={`OpenRouter: ${usd(credits.used)} used of ${usd(credits.total)}`}
      data-testid="nav-openrouter-credits"
    >
      Balance {usd(credits.remaining)}
    </Button>
  )
}
