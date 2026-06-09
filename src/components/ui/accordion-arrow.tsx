import { ChevronRight } from 'lucide-react'

// Disclosure indicator for fold/accordion triggers: points right when closed, rotates to point
// down when open. Decorative — the trigger element carries the aria-expanded state.
export function AccordionArrow({ isOpen, className }: { isOpen: boolean; className?: string }) {
  return (
    <ChevronRight
      aria-hidden
      className={`size-5 transition ${isOpen ? 'rotate-90' : ''} ${className ?? ''}`}
    />
  )
}
