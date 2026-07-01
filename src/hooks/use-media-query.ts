'use client'

import { useSyncExternalStore } from 'react'

// `useSyncExternalStore` (not `useEffect`) is the idiomatic media-query subscription: no effect,
// SSR-safe, and no first-paint flash of the wrong variant. The server snapshot is `false` — viewport
// and display mode are unknowable until hydration, so the "not matched" default is the safe one.
//
// `getSnapshot` is overridable for the rare query whose truth isn't captured by `matches` alone
// (e.g. iOS's non-standard `navigator.standalone` for installed PWAs); most callers omit it.
export function useMediaQuery(query: string, getSnapshot?: () => boolean) {
  return useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', callback)
      return () => mql.removeEventListener('change', callback)
    },
    getSnapshot ?? (() => window.matchMedia(query).matches),
    () => false,
  )
}
