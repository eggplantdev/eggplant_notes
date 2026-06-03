import type { NextConfig } from 'next'

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
    ]
  },
}

export default nextConfig
