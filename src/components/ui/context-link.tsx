import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'

import { MutedText } from '@/components/ui/muted-text'

type PropsT = {
  href: string
  children: ReactNode
  className?: string
}

// The trailing arrow is what marks the muted text as a navigable link at rest, not just on hover.
export function ContextLink({ href, children, className }: PropsT) {
  return (
    <MutedText asChild interactive className={className}>
      {/* flex (not inline-flex) + py-1.5 widen the tap target for mobile; the label is clamped to
          one line so a long note title can't wrap or push the arrow off-screen. */}
      <Link href={href} className="flex max-w-full items-center gap-1 py-1.5">
        <span className="line-clamp-1 min-w-0">{children}</span>
        <ArrowUpRight className="size-4.5 shrink-0" aria-hidden />
      </Link>
    </MutedText>
  )
}
