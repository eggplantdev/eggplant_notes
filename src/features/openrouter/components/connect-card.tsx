import { connectOpenRouter } from '@/features/openrouter/actions/connect'
import { disconnectOpenRouter } from '@/features/openrouter/actions/disconnect'
import { Button } from '@/components/ui/button'

// Connect/disconnect surface for OpenRouter BYOK. Both are Server Actions used as form actions:
// connect redirects to OpenRouter's OAuth page; disconnect deletes the credential row and
// revalidates. The API key is never rendered — only the connected/not-connected status.
export function ConnectCard({ connected }: { connected: boolean }) {
  if (connected) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" data-testid="openrouter-status">
          Connected — AI note &amp; card generation is available.
        </p>
        <form
          action={async () => {
            'use server'
            await disconnectOpenRouter()
          }}
        >
          <Button type="submit" variant="outline" size="sm" data-testid="openrouter-disconnect">
            Disconnect
          </Button>
        </form>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground text-sm" data-testid="openrouter-status">
        Connect your OpenRouter account to generate notes and cards with AI (uses your own key).
      </p>
      <form action={connectOpenRouter}>
        <Button type="submit" size="sm" data-testid="openrouter-connect">
          Connect OpenRouter
        </Button>
      </form>
    </div>
  )
}
