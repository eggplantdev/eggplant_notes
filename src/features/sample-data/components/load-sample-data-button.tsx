'use client'

import { Button } from '@/components/ui/button'
import { loadSampleData } from '@/features/sample-data/actions/load-sample-data'
import { useActionTransition } from '@/hooks/use-action-transition'

type LoadSampleDataButtonPropsT = {
  label?: string
  variant?: 'default' | 'outline'
}

// Shared Load trigger used by the notes empty state and the settings section. Fires the action
// through useActionTransition (pending state + success/error toast); no confirm dialog since the
// loader only ever writes into an already-empty account.
export function LoadSampleDataButton({
  label = 'Load sample data',
  variant = 'default',
}: LoadSampleDataButtonPropsT) {
  const { isPending, run } = useActionTransition()

  return (
    <Button
      variant={variant}
      data-testid="sample-data-load"
      disabled={isPending}
      onClick={() => run(() => loadSampleData(), { successMessage: 'Sample data loaded' })}
    >
      {isPending ? 'Loading…' : label}
    </Button>
  )
}
