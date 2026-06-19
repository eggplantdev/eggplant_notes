import { Pill } from '@/components/ui/pill'
import { cn } from '@/lib/utils'
import { formatReviewStatus, isCardOverdue } from '@/features/memory-cards/utils'
import type { MemoryCardListItemT } from '@/features/memory-cards/types'

// Shared cell renderers for a memory-card grid card — the due-status eyebrow, the prompt title, and
// the subject/note subtitle. Extracted so the /memory-cards listing and the dashboard due-card
// preview render an IDENTICAL card body off one source (only their action + border differ); editing
// the card's look stays a single edit.

// Eyebrow + title take only the slim fields they consume (not the full MemoryCardListItemT), so the
// in-note card section can feed them a raw MemoryCardT — which lacks the listing's note/subject
// embeds. The subtitle still needs those embeds, so it keeps the richer type.
export function renderCardEyebrow(card: { state: number; due_at: string }) {
  return (
    <span
      className={cn('text-xs', isCardOverdue(card) ? 'text-destructive' : 'text-muted-foreground')}
    >
      {formatReviewStatus(card)}
    </span>
  )
}

export function renderCardTitle(card: { prompt: string }) {
  return <span className="line-clamp-2">{card.prompt}</span>
}

export function renderCardSubtitle(card: MemoryCardListItemT) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
      {card.subjects?.title && <Pill>{card.subjects.title}</Pill>}
      {card.notes?.title && <span className="line-clamp-1">{card.notes.title}</span>}
    </div>
  )
}
