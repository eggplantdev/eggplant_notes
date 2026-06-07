import { Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { connectOpenRouter } from '@/features/openrouter/actions/connect'

// The single "Connect OpenRouter" CTA (label + icon + connect form), reused by the settings card,
// the AI connect-gate dialog, and the nav button (AG-1). `connectOpenRouter` redirects to
// OpenRouter's OAuth page. `className`/`testId` pass through for per-site layout and selectors.
//
// Must never be rendered inside another <form> — nested forms are invalid HTML and submit
// unpredictably (AG-3).
export function ConnectOpenRouterButton({
  className,
  testId = 'openrouter-connect',
}: {
  className?: string
  testId?: string
}) {
  return (
    <form action={connectOpenRouter}>
      <Button type="submit" variant="ai" size="sm" data-testid={testId} className={className}>
        <Sparkles />
        Connect OpenRouter
      </Button>
    </form>
  )
}
