'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'

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
  // Fire once per key. `searchParams` is a fresh object each render, so the effect re-runs before
  // router.replace lands (and twice under dev StrictMode) — without this guard the same key toasts
  // twice. Reset when the param clears so a later genuine repeat (e.g. two saves) still toasts.
  const toastedKey = useRef<string | null>(null)

  useEffect(() => {
    if (!key) {
      toastedKey.current = null
      return
    }
    if (!(key in TOAST_MESSAGES) || toastedKey.current === key) return
    toastedKey.current = key
    toastMessage(TOAST_MESSAGES[key as ToastKey], 'success')
    const next = new URLSearchParams(searchParams)
    next.delete('toast')
    router.replace(next.size ? `${pathname}?${next}` : pathname)
  }, [key, pathname, router, searchParams])

  return null
}
