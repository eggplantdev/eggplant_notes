import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardActions } from '@/components/ui/card-actions'
import { RenderMarkdown } from '@/components/markdown/render-markdown'
import { AnswerDisclosure } from '@/features/review/components/answer-disclosure'
import { buildPreviews } from '@/features/review/build-previews'
import { CaughtUpNotice } from '@/features/review/components/caught-up-notice'
import { RatingButtons } from '@/features/review/components/rating-buttons'
import { ReviewCelebrationProvider } from '@/features/review/components/review-celebration-context'
import { DeleteMemoryCardButton } from '@/features/memory-cards/components/delete-memory-card-button'
import { memoryCardEditHref } from '@/features/memory-cards/utils'
import { SourceNoteLink } from '@/features/notes/components/source-note-link'
import type { DueCardT } from '@/features/memory-cards/types'
import { cn } from '@/lib/utils'

// showCardControls: render per-card Edit/Delete in the header.
// advanceHref: passed through to RatingButtons; the panel uses it to clear its `?review` selection
// after a rating so the next card surfaces.
// reviewingAhead: today's daily goal is met, so the card shown is a bonus review beyond the goal;
// renders the "daily goal hit" notice above the card.
type PropsT = {
  card: DueCardT | undefined
  goal: number
  showCardControls?: boolean
  deleteRedirectTo?: string
  advanceHref?: string
  reviewingAhead?: boolean
  className?: string
}

// Server Component: owns the interval previews (computed only when a card is due). Wrapped in the
// celebration provider so the goal-crossing dialog survives RatingButtons unmounting when the last
// card is rated (lessons.md:141-145).
export function ReviewPanel({
  card,
  goal,
  showCardControls = false,
  deleteRedirectTo,
  advanceHref,
  reviewingAhead = false,
  className,
}: PropsT) {
  const body = !card ? (
    <Card className={cn('gradient-border ring-0', className)}>
      <CardContent>
        <CaughtUpNotice />
      </CardContent>
    </Card>
  ) : (
    <Card className="gradient-border ring-0">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-medium">Memory Card Review</CardTitle>
          <div className="flex shrink-0 items-center gap-2">
            {showCardControls && (
              <CardActions
                editHref={memoryCardEditHref(card.id)}
                deleteControl={
                  <DeleteMemoryCardButton
                    id={card.id}
                    noteId={card.note_id ?? undefined}
                    redirectTo={deleteRedirectTo}
                  />
                }
              />
            )}
          </div>
        </div>
        {card.note_id && card.notes?.title && (
          <SourceNoteLink
            noteId={card.note_id}
            subjectId={card.notes.subject_id}
            title={card.notes.title}
            // Mobile buttons are taller (h-8 vs h-7), so add breathing room below them; desktop keeps the tight header gap.
            className="mt-2 sm:mt-0"
          />
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RenderMarkdown content={card.prompt} />
        {card.example && (
          // key={card.id}: the panel advances in place, so without a per-card key React reuses the
          // same Collapsible instance and its uncontrolled open state leaks — the next card would
          // load with the answer already revealed, defeating recall.
          <AnswerDisclosure key={card.id}>
            <div className="mt-3 flex flex-col gap-3">
              <RenderMarkdown content={card.example} />
            </div>
          </AnswerDisclosure>
        )}
        <RatingButtons
          memoryCardId={card.id}
          previews={buildPreviews(card, new Date())}
          goal={goal}
          advanceHref={advanceHref}
        />
      </CardContent>
    </Card>
  )

  const content = (
    <>
      {reviewingAhead && (
        // mb matches the section gap-12 so the notice sits centered between the section above and the
        // panel, not glued to the card.
        <p className="text-muted-foreground mb-12 text-center text-sm">
          Daily goal hit 🎉 — bonus reviews.
        </p>
      )}
      {body}
    </>
  )

  return <ReviewCelebrationProvider>{content}</ReviewCelebrationProvider>
}
