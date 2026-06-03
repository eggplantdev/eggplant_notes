import Link from 'next/link'

import { RenderMarkdown } from '@/components/markdown/render-markdown'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatInterval } from '@/features/review/format-interval'
import { RatingButtons } from '@/features/review/rating-buttons'
import { previewIntervals } from '@/features/review/scheduling'
import { getTopicChecksDue } from '@/features/topic-checks/queries'

// The sequential review session (FR-016–019). Server Component: fetch the due queue, render
// the FIRST card with its four interval previews, and rely on the rate action's
// revalidatePath('/review') to advance — the just-rated card gets a future due_at and drops
// out, so this re-renders with the next card and no client-side queue state.
export default async function ReviewPage() {
  const due = await getTopicChecksDue()

  if (due.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 p-4 sm:p-6">
        <Card className="w-full text-center">
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
      </main>
    )
  }

  const card = due[0]
  const now = new Date()
  const intervals = previewIntervals(card, now)
  const previews: Record<number, string> = {
    1: formatInterval(now, intervals[1]),
    2: formatInterval(now, intervals[2]),
    3: formatInterval(now, intervals[3]),
    4: formatInterval(now, intervals[4]),
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Review</h1>
        <p className="text-muted-foreground text-sm">{due.length} due</p>
      </header>

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
    </main>
  )
}
