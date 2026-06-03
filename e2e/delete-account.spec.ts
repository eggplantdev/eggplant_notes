import { test, expect, type Page } from '@playwright/test'

// The account-lifecycle contract as an executable test: a user signs up, deletes
// their account from /settings behind the type-to-confirm gate, lands on
// /sign-in?deleted=1 with the notice, and can no longer sign in (account is gone).
// Sign-up goes through the real UI (F-01 auth/cookie/proxy path); deletion runs
// the SECURITY DEFINER delete_account() RPC + cascade under the hood.
const PASSWORD = 'password123'

// Unique per-run email so reruns don't collide on the shared local auth.users table.
function uniqueEmail() {
  return `e2e-del-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

async function signUp(page: Page, email: string) {
  await page.goto('/sign-up')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/dashboard')
}

test('account self-deletion: sign up -> delete -> cannot sign in again', async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)

  // Open the Danger zone; the confirm button is armed only after typing DELETE.
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Delete account' }).click()
  const confirm = page.getByRole('alertdialog').getByRole('button', { name: 'Delete account' })
  await expect(confirm).toBeDisabled()
  await page.getByLabel('Type DELETE to confirm').fill('DELETE')
  await expect(confirm).toBeEnabled()
  await confirm.click()

  // Lands back on sign-in with the deletion notice (session torn down, redirected).
  await expect(page).toHaveURL('/sign-in?deleted=1')
  await expect(page.getByText('Your account and all data were deleted.')).toBeVisible()

  // The deleted account can no longer authenticate.
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Invalid login credentials')).toBeVisible()
  await expect(page).toHaveURL(/\/sign-in/)
})
