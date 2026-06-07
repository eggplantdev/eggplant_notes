import { Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { connectOpenRouter } from '@/features/openrouter/actions/connect'

// Persistent nav affordance shown whenever OpenRouter is not connected, so AI features are
// discoverable from anywhere. Submits the same connect Server Action as /settings (redirects to
// OpenRouter's OAuth page). The caller decides when to render it (only when disconnected).
export function NavConnectButton({ className }: { className?: string }) {
  return (
    <form action={connectOpenRouter}>
      <Button
        type="submit"
        variant="ai"
        size="sm"
        data-testid="nav-openrouter-connect"
        className={className}
      >
        <Sparkles />
        Connect OpenRouter
      </Button>
    </form>
  )
}
