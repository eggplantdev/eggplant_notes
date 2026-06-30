'use client'

import type { ReactNode } from 'react'

import { AnimatedCardList } from '@/components/motion/animated-card-list'
import { CardActions } from '@/components/ui/card-actions'
import { DeleteMemoryCardButton } from '@/features/memory-cards/components/delete-memory-card-button'
import {
  renderCardEyebrow,
  renderCardTitle,
} from '@/features/memory-cards/components/memory-card-cells'
import { UnlinkCardButton } from '@/features/memory-cards/components/unlink-card-button'
import type { MemoryCardT } from '@/features/memory-cards/types'
import { memoryCardEditHref } from '@/features/memory-cards/utils'

// One row of the note's card list: the card plus its OPTIONAL pre-rendered answer body
// (example). The body must be pre-rendered by the server section because it goes
// through the server-only Shiki RenderMarkdown, which can't run inside this client component —
// it arrives as a ReactNode. `answer` present → expanded card (body under the prompt); absent →
// compact card (due-status + prompt only, matching the /memory-cards listing). This is how one
// wrapper covers both scenarios.
export type NoteCardRowT = { card: MemoryCardT; answer?: ReactNode }

// The note's linked cards through the SAME shared shell as the /memory-cards listing. A vertical
// stack rather than the listing's grid: these sit in the note's reading column, not a deck-wide
// grid. Client wrapper for the same reason as MemoryCardsList — AnimatedCardList takes render
// functions, which can't cross the RSC boundary.
export function NoteMemoryCardsList({ rows, noteId }: { rows: NoteCardRowT[]; noteId: string }) {
  return (
    <AnimatedCardList
      items={rows}
      getKey={(row) => row.card.id}
      renderEyebrow={(row) => renderCardEyebrow(row.card)}
      renderTitle={(row) => renderCardTitle(row.card)}
      renderDescription={(row) => row.answer}
      renderAction={(row) => (
        <CardActions
          editHref={memoryCardEditHref(row.card.id)}
          unlinkControl={<UnlinkCardButton id={row.card.id} noteId={noteId} />}
          deleteControl={<DeleteMemoryCardButton id={row.card.id} noteId={noteId} />}
        />
      )}
    />
  )
}
