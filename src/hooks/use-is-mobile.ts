'use client'

import { useSyncExternalStore } from 'react'

// Matches Tailwind's `md` breakpoint (768px) — below it we treat the viewport as "mobile".
const MOBILE_QUERY = '(max-width: 767px)'

function subscribe(callback: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

// `useSyncExternalStore` (not `useEffect`) is the idiomatic external-store subscription: no effect,
// SSR-safe, and no first-paint flash of the wrong variant. Server snapshot is `false` (desktop-first)
// because the layout viewport is unknown until hydration.
export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  )
}
