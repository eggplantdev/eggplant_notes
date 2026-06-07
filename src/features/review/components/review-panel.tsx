import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RenderMarkdown } from '@/components/markdown/render-markdown'
import { buildPreviews } from '@/features/review/build-previews'
import { RatingButtons } from '@/features/review/components/rating-buttons'
import { ReviewCelebrationProvider } from '@/features/review/components/review-celebration-context'
import { SourceNoteLink } from '@/features/notes/components/source-note-link'
import type { DueCardT } from '@/features/memory-cards/types'

type PropsT = { card: DueCardT | undefined; goal: number }

// Server Component: owns the interval previews (computed only when a card is due). The Provider
// wraps BOTH branches so the celebration dialog survives RatingButtons unmounting when the last
// card is rated (lessons.md:119-124).
export function ReviewPanel({ card, goal }: PropsT) {
  return (
    <ReviewCelebrationProvider>
      {!card ? (
        <p className="text-muted-foreground text-center text-sm">
          All caught up 🎉 — no memory cards are due right now.
        </p>
      ) : (
        <Card className="gradient-border ring-0">
          <CardHeader>
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
              <details className="border-t pt-3">
                <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm select-none">
                  Show answer
                </summary>
                <div className="mt-3 flex flex-col gap-3">
                  {card.example && <RenderMarkdown content={card.example} />}
                  {card.code_context && <RenderMarkdown content={card.code_context} />}
                </div>
              </details>
            )}
            <RatingButtons
              memoryCardId={card.id}
              previews={buildPreviews(card, new Date())}
              goal={goal}
            />
          </CardContent>
        </Card>
      )}
    </ReviewCelebrationProvider>
  )
}
