'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

import { TOAST_MESSAGES, type ToastKey } from '@/components/toast-messages'
import { toastMessage } from '@/components/toasts'

// Strips ONLY the `toast` param, not the whole query, to preserve siblings like the `?subjects=` filter.
// The effect is the allowed URL-sync exception to "avoid useEffect". Must mount inside <Suspense>:
// useSearchParams without it de-opts the route to dynamic and fails the Next 16 build.
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
