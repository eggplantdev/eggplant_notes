import type { ReactNode } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MutedText } from '@/components/ui/muted-text'
import { RenderMarkdown } from '@/components/markdown/render-markdown'
import { AnswerDisclosure } from '@/features/review/components/answer-disclosure'
import { buildPreviews } from '@/features/review/build-previews'
import { CaughtUpNotice } from '@/features/review/components/caught-up-notice'
import { RatingButtons } from '@/features/review/components/rating-buttons'
import { ReviewCelebrationProvider } from '@/features/review/components/review-celebration-context'
import { SourceNoteLink } from '@/features/notes/components/source-note-link'
import type { DueCardT } from '@/features/memory-cards/types'

// provideCelebration: the dashboard self-provides (default) since it advances in place; the card
// page passes false and relies on the [id] layout's provider, which survives navigating to the next
// card (a queue walk router.pushes between cards). See lessons.md:141-145.
// subtitle: optional context line under the card title (the /memory-cards panel shows the active
// filter + due count here); omitted on the dashboard.
type PropsT = {
  card: DueCardT | undefined
  goal: number
  provideCelebration?: boolean
  subtitle?: ReactNode
}

// Server Component: owns the interval previews (computed only when a card is due). The celebration
// provider wraps BOTH branches so the dialog survives RatingButtons unmounting when the last card is
// rated (lessons.md:141-145) — owned here for the dashboard, by the [id] layout for the card page.
export function ReviewPanel({ card, goal, provideCelebration = true, subtitle }: PropsT) {
  const body = !card ? (
    <Card className="gradient-border ring-0">
      <CardContent>
        <CaughtUpNotice />
      </CardContent>
    </Card>
  ) : (
    <Card className="gradient-border ring-0">
      <CardHeader>
        {subtitle && <MutedText>{subtitle}</MutedText>}
        <CardTitle className="text-base font-medium">Memory Card Review</CardTitle>
        {card.note_id && card.notes?.title && (
          <SourceNoteLink
            noteId={card.note_id}
            subjectId={card.notes.subject_id}
            title={card.notes.title}
          />
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RenderMarkdown content={card.prompt} />
        {(card.example || card.code_context) && (
          // key={card.id}: the panel advances in place, so without a per-card key React reuses the
          // same Collapsible instance and its uncontrolled open state leaks — the next card would
          // load with the answer already revealed, defeating recall.
          <AnswerDisclosure key={card.id}>
            <div className="mt-3 flex flex-col gap-3">
              {card.example && <RenderMarkdown content={card.example} />}
              {card.code_context && <RenderMarkdown content={card.code_context} />}
            </div>
          </AnswerDisclosure>
        )}
        <RatingButtons
          memoryCardId={card.id}
          previews={buildPreviews(card, new Date())}
          goal={goal}
        />
      </CardContent>
    </Card>
  )

  return provideCelebration ? <ReviewCelebrationProvider>{body}</ReviewCelebrationProvider> : body
}
