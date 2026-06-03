import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

// Load `.env.local` into process.env for the spec processes. Next loads it natively for
// the webServer, but a raw Playwright spec does not — so without this, the isolation spec
// cannot read NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY to build its supabase-js clients.
loadEnv({ path: '.env.local' })

// Port is overridable (PORT env) so an isolated worktree can run E2E without colliding with
// another server on the default 3000. `next start` honours PORT for the webServer too.
const PORT = process.env.PORT ?? '3000'
const BASE_URL = `http://127.0.0.1:${PORT}`

// E2E runs against the LOCAL Supabase stack (supabase start) + the dev server.
// Vercel never runs these; they are a local pre-push gate. If a GitHub Actions
// E2E job is ever added, drop `channel: 'chrome'` (CI runners have no Chrome)
// and run `pnpm exec playwright install chromium` to use the bundled browser.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // auth flows share the local Supabase auth.users table
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    channel: 'chrome', // use system Google Chrome, no bundled browser download
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  // Run against a production build, NOT `next dev`: dev-mode on-demand compilation
  // and Fast Refresh cause hydration races (the form submits natively before React
  // attaches its handler), which flake the suite. `build && start` is deterministic.
  webServer: {
    command: 'pnpm build && pnpm start',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
