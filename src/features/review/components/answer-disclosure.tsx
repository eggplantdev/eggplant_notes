'use client'

import type { ReactNode } from 'react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

type PropsT = { children: ReactNode }

// The disclosure lives behind its own client boundary on purpose. ReviewPanel is a Server Component,
// and rendering the Radix Collapsible (which derives its trigger/content ids from `useId`) directly as
// a server-component child made the SSR pass and the client RSC-reconstruction allocate different ids —
// a hydration mismatch on the trigger's aria-controls. Inside a contiguous client subtree the id is
// stable, so the whole disclosure is rendered here. The answer markdown stays an async Server Component:
// ReviewPanel renders it and passes it in as `children`, so it never crosses into the client bundle.
export function AnswerDisclosure({ children }: PropsT) {
  return (
    <Collapsible className="border-t pt-3">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground cursor-pointer text-sm select-none"
        >
          Show answer
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  )
}
