'use client'

import { useState, useTransition } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { Button } from '@/components/ui/button'
import { rateTopicCheck } from '@/features/review/actions/rate-topic-check'

type PropsT = { topicCheckId: string; previews: Record<number, string> }

// Grade -> button presentation. Order is the Anki convention (Again..Easy = FSRS Rating 1..4).
const GRADE_BUTTONS = [
  { grade: 1, label: 'Again', variant: 'destructive' },
  { grade: 2, label: 'Hard', variant: 'outline' },
  { grade: 3, label: 'Good', variant: 'default' },
  { grade: 4, label: 'Easy', variant: 'secondary' },
] as const

// Four rating buttons, each showing its predicted next interval (server-formatted). Clicking
// fires rateTopicCheck inside a transition for the pending/disabled state; the action
// revalidates /review so the next due card streams in with no client queue state (no useEffect).
// A returned failure surfaces inline. Buttons stack two-up on narrow widths (~360px), four-up
// from sm.
export function RatingButtons({ topicCheckId, previews }: PropsT) {
  const [error, setError] = useState<string | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  function rate(grade: number) {
    setError(undefined)
    startTransition(async () => {
      const result = await rateTopicCheck(topicCheckId, grade)
      if (!result.success) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <FormError message={error} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GRADE_BUTTONS.map(({ grade, label, variant }) => (
          <Button
            key={grade}
            variant={variant}
            size="lg"
            disabled={isPending}
            onClick={() => rate(grade)}
            className="h-auto flex-col gap-0.5 py-2"
          >
            <span className="font-semibold">{label}</span>
            <span className="text-xs opacity-80">{previews[grade]}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}
