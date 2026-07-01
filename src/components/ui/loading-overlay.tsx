'use client'

import { WandSparkles } from 'lucide-react'
import { createPortal } from 'react-dom'

import { Spinner } from '@/components/ui/spinner'

type PropsT = {
  // Distinguishes AI generation from a plain page revalidate (rating a card) so its latency
  // doesn't read as a hang.
  wand?: boolean
}

// Full-screen, page-centered loading overlay — the standard busy indicator for an in-place action
// whose latency has no other affordance (rating a card, AI generation). Portalled to <body> so
// `fixed` is viewport-relative and escapes any transformed ancestor (e.g. a dialog's -translate-x).
// pointer-events-none lets the page stay non-interactive without an opaque scrim. Render it
// conditionally — `{busy && <LoadingOverlay />}` — so createPortal never runs during SSR.
export function LoadingOverlay({ wand }: PropsT) {
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-60 grid place-items-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="size-12 [--spinner-w:4px]" />
        {wand && <WandSparkles className="text-neon-cyan size-5 animate-pulse" />}
      </div>
    </div>,
    document.body,
  )
}
