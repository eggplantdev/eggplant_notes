import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // E2E builds to an isolated output dir via NEXT_DIST_DIR so `pnpm test:e2e` can build+start
  // its own production server while a `next dev` server keeps running on the default `.next`
  // — without colliding on the Next build lock. Dev and Vercel leave NEXT_DIST_DIR unset, so
  // they use `.next` as before.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Allow cross-origin dev requests from this LAN IP (e.g. testing on a phone on the same network).
  // Dev-only: Next validates this for the dev server's internal asset/HMR requests.
  experimental: {
    // The PDF import action (generateNotes file path) sends a base64 PDF in the Server Action body;
    // a 10 MB PDF is ~13.4 MB base64. The default Server Action body limit is 1 MB, which would
    // reject real PDFs with an opaque framework error before the action's own 10 MB Zod cap/message
    // runs. Raise it so the Zod cap is the true boundary and the friendly error fires.
    serverActions: { bodySizeLimit: '14mb' },
    // Enable the client Router Cache for dynamic (cookie-bound) routes: repeat navigation between
    // authed pages within 5 min is served from in-browser memory instead of a fresh server round-trip.
    // The cost — a cached page can show stale data after a write — is paid by busting the cache at every
    // mutation surface (revalidatePath('/', 'layout')). `static` is left at its 5-min default. This flips
    // the premise of lessons.md "revalidatePath on a dynamic page is a no-op": once dynamic != 0, those
    // busts become load-bearing. See context/changes/nav-cache-staletimes/.
    staleTimes: { dynamic: 300 },
  },
}

export default nextConfig
