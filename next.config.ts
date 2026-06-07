import { createJiti } from 'jiti'
import type { NextConfig } from 'next'

// Validate env at BUILD start (next.config is evaluated first), so a missing/malformed var fails
// the build instead of surfacing at runtime. jiti loads the app's TS env modules portably across
// Next versions. `./src/lib/env` runs the client parse; `serverSchema.parse` validates the server
// vars WITHOUT importing the server-only env.server.ts (which can't resolve outside Next's app
// compilation). Next loads .env* before this file, so process.env is already populated.
const jiti = createJiti(import.meta.url)
jiti('./src/lib/env')
const { serverSchema } = jiti('./src/lib/env-schema') as typeof import('./src/lib/env-schema')
serverSchema.parse(process.env)

const nextConfig: NextConfig = {
  // E2E builds to an isolated output dir via NEXT_DIST_DIR so `pnpm test:e2e` can build+start
  // its own production server while a `next dev` server keeps running on the default `.next`
  // — without colliding on the Next build lock. Dev and Vercel leave NEXT_DIST_DIR unset, so
  // they use `.next` as before.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: true,
      },
      {
        // /review was relocated onto /dashboard. 307 (not 308) — a relocation that could
        // plausibly revert, and 308s get aggressively browser-cached.
        source: '/review',
        destination: '/dashboard',
        permanent: false,
      },
    ]
  },
}

export default nextConfig
