'use client'

import { AnimatedCardList } from '@/components/motion/animated-card-list'
import { CardActions } from '@/components/ui/card-actions'
import { DeleteMemoryCardButton } from '@/features/memory-cards/delete-memory-card-button'
import type { MemoryCardListItemT } from '@/features/memory-cards/types'
import { formatReviewStatus, memoryCardEditHref } from '@/features/memory-cards/utils'

// Thin client wrapper over the shared AnimatedCardList: supplies the memory-card card href, the
// prompt as the title, a review-status eyebrow, and a subtitle of the subject ("topic") chip +
// source-note title. Data is fetched on the server (MemoryCardsPage) and passed in; this stays a
// client component only so it can hand render functions to the list. Unlike NotesList there are no
// per-card actions — editing/deleting a check lives on the note detail. The card→note href deep-
// links to the exact check (`#check-<id>`), the card→note differentiator.
export function MemoryCardsList({ checks }: { checks: MemoryCardListItemT[] }) {
  return (
    <AnimatedCardList
      gridLayout
      items={checks}
      getKey={(check) => check.id}
      getHref={(check) => `/notes/${check.note_id}#check-${check.id}`}
      renderAction={(check) => (
        <CardActions
          editHref={memoryCardEditHref(check.note_id, check.id)}
          deleteControl={<DeleteMemoryCardButton noteId={check.note_id} id={check.id} />}
        />
      )}
      renderTitle={(check) => <span className="line-clamp-2">{check.prompt}</span>}
      renderEyebrow={(check) => (
        <span className="text-muted-foreground text-xs">{formatReviewStatus(check)}</span>
      )}
      renderSubtitle={(check) => (
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          {check.notes?.subjects?.title && (
            <span className="bg-muted text-foreground line-clamp-1 max-w-full rounded px-1.5 py-0.5 font-medium">
              {check.notes.subjects.title}
            </span>
          )}
          {check.notes?.title && <span className="line-clamp-1">{check.notes.title}</span>}
        </div>
      )}
    />
  )
}
