import { defineConfig, devices } from '@playwright/test'

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
    baseURL: 'http://127.0.0.1:3000',
    channel: 'chrome', // use system Google Chrome, no bundled browser download
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
