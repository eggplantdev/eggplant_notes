import type { ComponentProps } from 'react'

import { Button } from '@/components/ui/button'
import { signOut } from '@/features/auth/actions/sign-out'

type SignOutButtonPropsT = {
  className?: string
  size?: ComponentProps<typeof Button>['size']
}

// Wraps the signOut server action in its submit form once, so nav surfaces (and any
// future caller) render sign-out without re-handwriting the form. className/size let each
// caller style the button to its context (inline bar vs full-width sheet row).
export function SignOutButton({ className, size }: SignOutButtonPropsT) {
  return (
    <form action={signOut}>
      <Button variant="outline" size={size} type="submit" className={className}>
        Sign out
      </Button>
    </form>
  )
}
