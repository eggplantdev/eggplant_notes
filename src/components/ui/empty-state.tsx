import Link from 'next/link'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

// Shared empty-state panel. Omit `action` for filtered/"no match" states; pass it for "nothing here yet".
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
