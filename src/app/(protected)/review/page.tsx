import Link from 'next/link'

import { PageShell } from '@/components/layout/page-shell'
import { RenderMarkdown } from '@/components/markdown/render-markdown'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatInterval } from '@/features/review/format-interval'
import { RatingButtons } from '@/features/review/rating-buttons'
import { previewIntervals } from '@/features/review/scheduling'
import { getDueQueue } from '@/features/topic-checks/queries'

// The sequential review session (FR-016–019). Server Component: fetch the due queue (the
// soonest-due card + the total count), render that FIRST card with its four interval previews,
// and rely on the rate action's revalidatePath('/review') to advance — the just-rated card
// gets a future due_at and drops out, so this re-renders with the next card and no client-side
// queue state. Both states share PageShell, so the title and "N due" persist even when empty.
export default async function ReviewPage() {
  const { first: card, count } = await getDueQueue()

  const now = new Date()
  const previews: Record<number, string> = card
    ? Object.fromEntries(
        Object.entries(previewIntervals(card, now)).map(([grade, due]) => [
          grade,
          formatInterval(now, due),
        ]),
      )
    : {}

  return (
    <PageShell
      title="Review"
      width="prose"
      hideTitleOnMobile
      actions={<p className="text-muted-foreground text-sm">{count} due</p>}
    >
      {!card ? (
        <Card className="text-center">
          <CardHeader>
            <CardTitle>All caught up 🎉</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <p className="text-muted-foreground text-sm">
              No topic checks are due right now. Come back when more are scheduled.
            </p>
            <Button asChild>
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Recall</CardTitle>
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

          <RatingButtons topicCheckId={card.id} previews={previews} />
        </>
      )}
    </PageShell>
  )
}
