'use client'

import { useMediaQuery } from '@/hooks/use-media-query'

// True when the app is launched as an installed PWA (no browser chrome). Android/Chrome/desktop match
// the display-mode query; older iOS Safari only sets the non-standard `navigator.standalone`, so we OR both.
const STANDALONE_QUERY = '(display-mode: standalone)'

export function useIsStandalone() {
  return useMediaQuery(
    STANDALONE_QUERY,
    () =>
      window.matchMedia(STANDALONE_QUERY).matches ||
      // iOS-only, not typed on Navigator.
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
  )
}
