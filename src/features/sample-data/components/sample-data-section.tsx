'use client'

import { Button } from '@/components/ui/button'
import { clearSampleData } from '@/features/sample-data/actions/clear-sample-data'
import { LoadSampleDataButton } from '@/features/sample-data/components/load-sample-data-button'
import { LoadSampleDataDialog } from '@/features/sample-data/components/load-sample-data-dialog'
import { useActionTransition } from '@/hooks/use-action-transition'

type SampleDataSectionPropsT = {
  accountEmpty: boolean
}

// Empty account → one-click load (nothing to lose). Non-empty → the wipe-then-load ceremony, which
// re-auths and clears existing content first. Clear always shows and only removes is_seeded rows
// (no-op when none). `accountEmpty` is resolved server-side and refreshes on revalidation after load/clear.
export function SampleDataSection({ accountEmpty }: SampleDataSectionPropsT) {
  const { isPending, run } = useActionTransition()

  return (
    <div className="flex flex-wrap items-center gap-3">
      {accountEmpty ? <LoadSampleDataButton /> : <LoadSampleDataDialog />}
      <Button
        variant="outline"
        data-testid="sample-data-clear"
        disabled={isPending}
        onClick={() =>
          run(() => clearSampleData(), {
            successMessage: 'Sample data cleared',
            toastError: true, // bare button — no inline error surface
          })
        }
      >
        {isPending ? 'Clearing…' : 'Clear sample data'}
      </Button>
    </div>
  )
}
