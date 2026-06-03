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
  // The local-GoTrue sign-up race (lessons.md) is environmental and worsens over a long run.
  // A retry reruns the whole test from the top — and uniqueEmail() is called inside each test
  // body, so each retry gets a brand-new account, side-stepping the race instead of gating on
  // it. trace below captures the first retry, so a real regression still leaves evidence.
  retries: 2,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    channel: 'chrome', // use system Google Chrome, no bundled browser download
    trace: 'on-first-retry',
  },
  // `dashboard` specs are read-only smoke against dummy data → they reuse one shared session
  // (the `setup` project signs up once, saves storageState) instead of each signing up afresh.
  // `setup` only runs as a dependency of `dashboard`, so filtered runs of other specs pay no
  // extra sign-up. Everything else (mutation / empty-state / isolation) stays on fresh sign-up.
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'dashboard',
      testMatch: /dashboard\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        storageState: 'e2e/.auth/dashboard.json',
      },
    },
    {
      name: 'chromium',
      testIgnore: /dashboard\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
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
