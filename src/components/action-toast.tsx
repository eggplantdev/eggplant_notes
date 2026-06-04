'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

import { TOAST_MESSAGES, type ToastKey } from '@/components/toast-messages'
import { toastMessage } from '@/components/toasts'

// Reads `?toast=<key>` after a post-redirect navigation, toasts the mapped message once, then
// strips ONLY the `toast` param (preserving siblings like the `?subjects=` notes filter — never
// `router.replace(pathname)`, which would drop them). Generalizes the old account-deletion
// query-flag notice into one global reader for every redirect-on-success action.
//
// The effect is INTENTIONAL: a toast-once-on-mount-from-URL + strip side effect (synchronizing
// with the URL, an external system) — the allowed exception to "avoid useEffect", NOT the banned
// derived-state-in-effect pattern. Mounted once in the root layout inside <Suspense> (a
// useSearchParams requirement in Next 16, or it de-opts the route to dynamic and fails build).
export function ActionToast() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const key = searchParams.get('toast')

  useEffect(() => {
    if (!key || !(key in TOAST_MESSAGES)) return
    toastMessage(TOAST_MESSAGES[key as ToastKey], 'success')
    const next = new URLSearchParams(searchParams)
    next.delete('toast')
    router.replace(next.size ? `${pathname}?${next}` : pathname)
  }, [key, pathname, router, searchParams])

  return null
}
