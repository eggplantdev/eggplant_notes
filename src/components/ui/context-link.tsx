import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'

import { MutedText } from '@/components/ui/muted-text'

type PropsT = {
  href: string
  children: ReactNode
  className?: string
}

// Muted, arrow-suffixed navigation link — the shared "go somewhere related" affordance (a
// card's source note, a note's surrounding subject). The trailing arrow is what marks the muted
// text as a navigable link at rest, not just on hover. Presentational only: the caller owns the
// href and label, so it carries no domain knowledge.
export function ContextLink({ href, children, className }: PropsT) {
  return (
    <MutedText asChild interactive className={className}>
      <Link href={href} className="inline-flex items-center gap-1">
        {children}
        <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
      </Link>
    </MutedText>
  )
}
