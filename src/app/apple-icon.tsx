import { ImageResponse } from 'next/og'

import { brandIconElement } from '@/components/brand/brand-icon-image'

// iOS home-screen icon. Safari ignores the manifest's icons entirely and reads this via the
// auto-emitted <link rel="apple-touch-icon">; 180px is the modern Retina touch-icon size.
export const contentType = 'image/png'
export const size = { width: 180, height: 180 }

export default function AppleIcon() {
  return new ImageResponse(brandIconElement(size.width), { ...size })
}
