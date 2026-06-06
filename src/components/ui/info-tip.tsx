'use client'

import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// Small inline "ⓘ" affordance that reveals a short explanatory tip on hover/focus. Non-domain:
// the caller passes the tip body, so it carries no feature knowledge.
export function InfoTip({
  children,
  label = 'More info',
}: {
  children: ReactNode
  label?: string
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger
          type="button"
          aria-label={label}
          className="text-muted-foreground hover:text-foreground inline-flex transition-colors"
        >
          <Info className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-left leading-relaxed">{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
