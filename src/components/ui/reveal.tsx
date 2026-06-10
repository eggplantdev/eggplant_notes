import type { ReactNode } from 'react'

import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'

// One-way / state-driven reveal: the same expand animation as Collapsible, but with no trigger — the
// caller owns `open`. For disclosures whose open affordance lives elsewhere (a button that vanishes once
// opened) rather than a persistent toggle. Content stays unmounted until `open`, so a lazy child (e.g. a
// CodeMirror editor) isn't loaded until revealed.
type PropsT = { open: boolean; className?: string; children: ReactNode }

export function Reveal({ open, className, children }: PropsT) {
  return (
    <Collapsible open={open}>
      <CollapsibleContent className={className}>{children}</CollapsibleContent>
    </Collapsible>
  )
}
