import { ImageResponse } from 'next/og'

import { brandIconElement } from '@/components/brand/brand-icon-image'

// Manifest icon (Android/Chrome/desktop). The folder name IS the URL — served at /app-icon-192.png,
// referenced by app/manifest.ts. ImageResponse is a Response subclass, so returning it from GET works.
export function GET() {
  return new ImageResponse(brandIconElement(192), { width: 192, height: 192 })
}
