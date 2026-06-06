'use client'

import { Button } from '@/components/ui/button'
import { clearSampleData } from '@/features/sample-data/actions/clear-sample-data'
import { LoadSampleDataButton } from '@/features/sample-data/components/load-sample-data-button'
import { useActionTransition } from '@/hooks/use-action-transition'

// No gating query on render — both buttons always show and the actions enforce correctness:
// Load's guard rejects a non-empty account, Clear only removes is_seeded rows (no-op when none).
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
