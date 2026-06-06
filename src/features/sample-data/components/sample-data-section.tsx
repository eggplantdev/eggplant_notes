'use client'

import { Button } from '@/components/ui/button'
import { clearSampleData } from '@/features/sample-data/actions/clear-sample-data'
import { LoadSampleDataButton } from '@/features/sample-data/components/load-sample-data-button'
import { useActionTransition } from '@/hooks/use-action-transition'

// Self-correcting controls — NO gating query on render (settings is a cold page; probing it every
// visit for a one-time demo action is wasteful). Both buttons always show; the actions enforce
// correctness: Load's guard rejects a non-empty account, Clear only removes is_seeded rows (a
// no-op when there are none). State is never read eagerly — only an explicit click hits the DB.
export function SampleDataSection() {
  const { isPending, run } = useActionTransition()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <LoadSampleDataButton />
      <Button
        variant="outline"
        data-testid="sample-data-clear"
        disabled={isPending}
        onClick={() => run(() => clearSampleData(), { successMessage: 'Sample data cleared' })}
      >
        {isPending ? 'Clearing…' : 'Clear sample data'}
      </Button>
    </div>
  )
}
