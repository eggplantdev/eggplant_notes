import { ImageResponse } from 'next/og'

import { brandIconElement } from '@/components/brand/brand-icon-image'

// Manifest icon (Android/Chrome/desktop) — the 512 splash/install size. Served at /app-icon-512.png.
export function GET() {
  return new ImageResponse(brandIconElement(512), { width: 512, height: 512 })
}
