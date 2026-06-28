'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { toastSuccess } from '@/components/toasts'
import { TOAST_MESSAGES, type ToastKey } from '@/components/toast-messages'

// Client-side post-action navigation. A server-action redirect() bypasses the destination's
// loading.tsx; pushing on the client inside a transition shows it and keeps `isNavigating` true
// through the destination render (so the trigger button stays pending). Toasts directly — no
// `?toast=` round-trip, since the client (unlike a server redirect) can fire the toast itself.
//
// `to` is passed explicitly by the caller: a literal for client-known URLs, or `result.redirectTo`
// (typed required via RedirectResultT) for server-born ids. No optional-field guard anywhere.
export function useActionNavigation() {
  const router = useRouter()
  const [isNavigating, startTransition] = useTransition()

  function navigate(to: string, toastKey?: ToastKey) {
    if (toastKey) toastSuccess(TOAST_MESSAGES[toastKey])
    startTransition(() => router.push(to))
  }

  return { isNavigating, navigate }
}
