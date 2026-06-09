import { ConnectOpenRouterButton } from '@/features/openrouter/components/connect-openrouter-button'

// Persistent nav affordance shown whenever OpenRouter is not connected, so AI features are
// discoverable from anywhere. The caller decides when to render it (only when disconnected).
export function NavConnectButton({ className }: { className?: string }) {
  return <ConnectOpenRouterButton className={className} testId="nav-openrouter-connect" />
}
