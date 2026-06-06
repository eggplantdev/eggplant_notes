import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RenderMarkdown } from '@/components/markdown/render-markdown'
import { buildPreviews } from '@/features/review/build-previews'
import { RatingButtons } from '@/features/review/rating-buttons'
import { ReviewCelebrationProvider } from '@/features/review/review-celebration-context'
import type { DueCardT } from '@/features/memory-cards/types'

type PropsT = { card: DueCardT | undefined; goal: number }

// The embedded review session (relocated from the old /review route). Server Component: it owns
// the server-side interval previews (previewIntervals runs only when a card is actually due) so
// the route stays pure composition. ReviewCelebrationProvider wraps BOTH branches so the
// goal-celebration dialog survives RatingButtons unmounting when the last card is rated
// (lessons.md:119-124). Advance is server-driven: rateMemoryCard revalidates /dashboard.
export function ReviewPanel({ card, goal }: PropsT) {
  return (
    <ReviewCelebrationProvider>
      {!card ? (
        <p className="text-muted-foreground text-center text-sm">
          All caught up 🎉 — no memory cards are due right now.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Recall</CardTitle>
              {card.notes?.title && (
                <Link
                  href={`/notes/${card.note_id}`}
                  className="text-muted-foreground hover:text-foreground text-sm"
                >
                  From: {card.notes.title}
                </Link>
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
            </CardContent>
          </Card>

          <RatingButtons
            memoryCardId={card.id}
            previews={buildPreviews(card, new Date())}
            goal={goal}
          />
        </div>
      )}
    </ReviewCelebrationProvider>
  )
}
