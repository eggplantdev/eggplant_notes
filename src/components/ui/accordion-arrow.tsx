import { ChevronRight } from 'lucide-react'

// Disclosure indicator for fold/accordion triggers: points right when closed, rotates to point
// down when open. Decorative — the trigger element carries the aria-expanded state. Lights up
// neon-cyan on hover, so the trigger must be a `group` ancestor (group-hover drives the glow).
export function AccordionArrow({ isOpen, className }: { isOpen: boolean; className?: string }) {
  return (
    <ChevronRight
      aria-hidden
      className={`group-hover:text-neon-cyan group-hover:drop-shadow-neon-cyan size-5 transition ${isOpen ? 'rotate-90' : ''} ${className ?? ''}`}
    />
  )
}
