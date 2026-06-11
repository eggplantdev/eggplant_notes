'use client'

import { Button } from '@/components/ui/button'
import { loadSampleData } from '@/features/sample-data/actions/load-sample-data'
import { useActionTransition } from '@/hooks/use-action-transition'

type LoadSampleDataButtonPropsT = {
  label?: string
  variant?: 'default' | 'outline'
}

// No confirm dialog: the loader only ever writes into an already-empty account.
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
      onClick={() =>
        run(() => loadSampleData(), {
          successMessage: 'Sample data loaded',
          toastError: true, // bare button — no inline error surface
        })
      }
    >
      {isPending ? 'Loading…' : label}
    </Button>
  )
}
