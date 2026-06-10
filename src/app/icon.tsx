import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const contentType = 'image/png'
export const size = { width: 64, height: 64 }

// ImageResponse (Satori) can't fetch a relative URL, so read the PNG off disk and inline it as base64.
export default async function Icon() {
  const data = await readFile(join(process.cwd(), 'public/logos/eggplant-logo.png'))
  const src = `data:image/png;base64,${data.toString('base64')}`

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img alt="Eggplant logo" src={src} width={64} height={64} />
    </div>,
    { ...size },
  )
}
