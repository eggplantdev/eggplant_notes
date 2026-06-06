import type { ComponentProps } from 'react'

import { Button } from '@/components/ui/button'
import { signOut } from '@/features/auth/actions/sign-out'

type SignOutButtonPropsT = {
  className?: string
  size?: ComponentProps<typeof Button>['size']
}

export function SignOutButton({ className, size }: SignOutButtonPropsT) {
  return (
    <form action={signOut}>
      <Button variant="outline" size={size} type="submit" className={className}>
        Sign out
      </Button>
    </form>
  )
}
