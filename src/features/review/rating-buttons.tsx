'use client'

import { FormError } from '@/components/forms/form-components/form-error'
import { Button } from '@/components/ui/button'
import { rateTopicCheck } from '@/features/review/actions/rate-topic-check'
import { GRADES } from '@/features/review/grades'
import { useActionTransition } from '@/hooks/use-action-transition'

type PropsT = { topicCheckId: string; previews: Record<number, string> }

// Four rating buttons, each showing its predicted next interval (server-formatted). Clicking
// fires rateTopicCheck via useActionTransition (pending/disabled state + inline error); the
// action revalidates /review so the next due card streams in with no client queue state (no
// useEffect). Buttons stack two-up on narrow widths (~360px), four-up from sm.
export function RatingButtons({ topicCheckId, previews }: PropsT) {
  const { error, isPending, run } = useActionTransition()

  return (
    <div className="flex flex-col gap-3">
      <FormError message={error} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GRADES.map(({ grade, label, variant }) => (
          <Button
            key={grade}
            variant={variant}
            size="lg"
            disabled={isPending}
            onClick={() => run(() => rateTopicCheck(topicCheckId, grade))}
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
