import { test as setup } from '@playwright/test'

import { signUp, uniqueEmail } from './helpers'

// One real UI sign-up whose authenticated session the read-only dashboard specs reuse
// (via the `dashboard` project's storageState in playwright.config.ts) instead of each
// signing up afresh and piling onto the local-GoTrue load that degrades over a long run
// (see lessons.md). Mutation / empty-state / isolation specs deliberately keep their own
// fresh sign-ups — their assertions require a clean or distinct account.
const authFile = 'e2e/.auth/dashboard.json'

setup('authenticate the shared dashboard user', async ({ page }) => {
  // signUp pre-sets the welcome-seen cookie, so the captured storageState already suppresses the
  // dashboard onboarding dialog for the shared read-only specs.
  await signUp(page, uniqueEmail('dash-shared'))
  await page.context().storageState({ path: authFile })
})
