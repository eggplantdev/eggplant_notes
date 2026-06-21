import type { MetadataRoute } from 'next'

import { BRAND_DARK } from '@/components/brand/brand-colors'

// Web App Manifest — makes the app installable and launches it standalone (no browser chrome).
// Next auto-links this from <head> (rel="manifest"); no manual <link> needed. iOS ignores the icons
// here (it reads app/apple-icon.tsx instead), so this primarily serves Android/Chrome/desktop.
//
// start_url is the in-app entry, not '/': installers want to land inside the app. Auth is NOT decided
// here — the proxy (src/proxy.ts) gates /dashboard, so an unauthenticated launch bounces to /sign-in
// while a live session cookie lands straight in. The cookie-based @supabase/ssr session survives the
// standalone launch, which is what makes "tap icon → already logged in" work.
export default function manifest(): MetadataRoute.Manifest {
  const icons = [
    { src: '/app-icon-192.png', sizes: '192x192' },
    { src: '/app-icon-512.png', sizes: '512x512' },
  ] as const

  return {
    name: 'Eggplant Notes',
    short_name: 'Eggplant',
    description: 'AI powered notes with spaced-repetition recall cards.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: BRAND_DARK,
    theme_color: BRAND_DARK,
    icons: icons.flatMap(({ src, sizes }) =>
      // Each size listed as both 'any' (generic) and 'maskable' (adaptive/circular masks); the icon
      // is rendered with safe-zone padding, so one image serves both purposes.
      (['any', 'maskable'] as const).map((purpose) => ({
        src,
        sizes,
        type: 'image/png',
        purpose,
      })),
    ),
  }
}
