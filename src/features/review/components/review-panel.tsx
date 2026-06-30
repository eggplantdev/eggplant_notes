import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ButtonLink } from '@/components/ui/button-link'
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

// provideCelebration: both surfaces (dashboard, /memory-cards) advance in place, so they self-provide
// the celebration dialog (default true).
// showCardControls: render per-card Edit/Delete in the header — on for both in-place review panels.
// advanceHref: passed through to RatingButtons; the /memory-cards panel uses it to clear its
// `?review` selection after a rating so the next card surfaces (omitted on the dashboard).
// reviewHref: when set, a "Review" link to the full review surface shows in the header — the dashboard
// uses it to send the user to /memory-cards (it reviews in place but is not the dedicated surface).
type PropsT = {
  card: DueCardT | undefined
  goal: number
  provideCelebration?: boolean
  showCardControls?: boolean
  deleteRedirectTo?: string
  advanceHref?: string
  reviewHref?: string
}

// Server Component: owns the interval previews (computed only when a card is due). The celebration
// provider wraps BOTH branches so the dialog survives RatingButtons unmounting when the last card is
// rated (lessons.md:141-145).
export function ReviewPanel({
  card,
  goal,
  provideCelebration = true,
  showCardControls = false,
  deleteRedirectTo,
  advanceHref,
  reviewHref,
}: PropsT) {
  const body = !card ? (
    <Card className="gradient-border ring-0">
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
            {reviewHref && (
              <ButtonLink href={reviewHref} variant="outline" size="sm">
                Review
              </ButtonLink>
            )}
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

  return provideCelebration ? <ReviewCelebrationProvider>{body}</ReviewCelebrationProvider> : body
}
