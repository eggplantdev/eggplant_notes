'use client'

import { WandSparkles } from 'lucide-react'
import { createPortal } from 'react-dom'

import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  // Distinguishes AI generation from a plain page revalidate (rating a card) so its latency
  // doesn't read as a hang.
  wand?: boolean
}

// Full-screen, page-centered loading overlay — the standard busy indicator for an in-place action
// whose latency has no other affordance (rating a card, AI generation). Portalled to <body> so
// `fixed` is viewport-relative and escapes any transformed ancestor (e.g. a dialog's -translate-x).
// Render it conditionally — `{busy && <LoadingOverlay />}` — so createPortal never runs during SSR.
// AI generation (`wand`) gets a dimming backdrop + a latency explainer, since its wait can be long
// and model-dependent; the plain revalidate stays a transparent, pointer-events-none indicator.
export function LoadingOverlay({ wand }: PropsT) {
  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-60 grid place-items-center',
        wand ? 'bg-background/80 backdrop-blur-sm' : 'pointer-events-none',
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner className="size-12 [--spinner-w:4px]" />
        {wand && (
          <>
            <p className="text-muted-foreground max-w-xs text-center text-sm text-balance">
              Generating with AI… this can take a little while depending on the model you selected.
            </p>
            <WandSparkles className="text-neon-cyan size-5 animate-pulse" />
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
