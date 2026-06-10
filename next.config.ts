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
  experimental: {
    // The PDF import action (generateNotes file path) sends a base64 PDF in the Server Action body;
    // a 10 MB PDF is ~13.4 MB base64. The default Server Action body limit is 1 MB, which would
    // reject real PDFs with an opaque framework error before the action's own 10 MB Zod cap/message
    // runs. Raise it so the Zod cap is the true boundary and the friendly error fires.
    serverActions: { bodySizeLimit: '14mb' },
  },
  async redirects() {
    return [
      {
        // 307 (not 308): keeps `/` reroutable. A 308 is browser-cached permanently, so a future
        // landing page / unauthenticated root would be unreachable for returning users.
        source: '/',
        destination: '/dashboard',
        permanent: false,
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
