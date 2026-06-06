import Link from 'next/link'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

// Shared empty-state panel: a dashed-border card with muted copy and an optional CTA link.
// Promoted out of the per-page empty branches (notes, subjects, memory-cards, subject view) once
// the markup was the same. Omit `action` for filtered/"no match" states (text only); pass it for
// "nothing here yet" states. `action.variant` defaults to 'outline' (the list-page CTA); the
// subject view passes 'default' for its primary "New note" prompt.
type EmptyStatePropsT = {
  message: ReactNode
  action?: { label: string; href: string; variant?: 'default' | 'outline' }
}

export function EmptyState({ message, action }: EmptyStatePropsT) {
  return (
    <div className="text-muted-foreground flex flex-col items-start gap-3 rounded-lg border border-dashed p-8">
      <p>{message}</p>
      {action && (
        <Button asChild variant={action.variant ?? 'outline'}>
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  )
}
