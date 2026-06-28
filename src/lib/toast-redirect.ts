import { redirect } from 'next/navigation'

import type { ToastKey } from '@/components/toast-messages'

// Server-side redirect for surfaces that can't hand navigation to the client: Route Handlers (the
// OAuth callback) and the post-account-delete jump to the unauthenticated /sign-in. Appends the
// `?toast=<key>` convention so <ActionToast> can toast after the navigation. A mistyped key fails
// typecheck. Client-navigated actions toast directly instead — see useActionNavigation.
export function toastRedirect(path: string, key: ToastKey): never {
  const separator = path.includes('?') ? '&' : '?'
  redirect(`${path}${separator}toast=${key}`)
}
