import { disconnectOpenRouter } from '@/features/openrouter/actions/disconnect'
import { ConnectOpenRouterButton } from '@/features/openrouter/components/connect-openrouter-button'
import { SettingsModelSelect } from '@/features/openrouter/components/settings-model-select'
import { Button } from '@/components/ui/button'

// Connect/disconnect surface for OpenRouter BYOK. Both are Server Actions used as form actions:
// connect redirects to OpenRouter's OAuth page; disconnect deletes the credential row and
// revalidates. The API key is never rendered — only the connected/not-connected status. When
// connected, the model picker persists the default model used for all AI generation.
export function ConnectCard({
  connected,
  defaultModel,
}: {
  connected: boolean
  defaultModel: string
}) {
  if (connected) {
    return (
      <div className="grid gap-4">
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
        <SettingsModelSelect defaultModel={defaultModel} />
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground text-sm" data-testid="openrouter-status">
        Connect your OpenRouter account to generate notes and cards with AI (uses your own key).
      </p>
      <ConnectOpenRouterButton testId="openrouter-connect" />
    </div>
  )
}
