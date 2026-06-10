import { test, expect } from '@playwright/test'

import { PASSWORD, signUp, uniqueEmail } from './helpers'

// The account-lifecycle contract as an executable test: a user signs up, deletes
// their account from /settings behind the type-to-confirm + password re-auth gate,
// lands on /sign-in with the "Account deleted" toast (S-16 ?toast flag), and can no
// longer sign in (account is gone).
// Sign-up goes through the real UI (F-01 auth/cookie/proxy path); deletion runs
// the SECURITY DEFINER delete_account() RPC + cascade under the hood. Shared helpers: ./helpers.

test('account self-deletion: sign up -> delete -> cannot sign in again', async ({ page }) => {
  const email = uniqueEmail('del')
  await signUp(page, email)

  // Open the Danger zone; the confirm button is armed only after typing DELETE *and* re-entering
  // the password (step-up re-auth). Typing DELETE alone leaves it disabled.
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Delete account' }).click()
  const confirm = page.getByRole('alertdialog').getByRole('button', { name: 'Delete account' })
  await expect(confirm).toBeDisabled()
  await page.getByLabel('Type DELETE to confirm').fill('DELETE')
  await expect(confirm).toBeDisabled()
  await page.getByLabel('Current password').fill(PASSWORD)
  await expect(confirm).toBeEnabled()
  await confirm.click()

  // Lands back on sign-in (session torn down, redirected); the account-deleted toast confirms via
  // the ?toast=account-deleted flag, which <ActionToast> reads then strips from the URL.
  await expect(page).toHaveURL(/\/sign-in/)
  await expect(page.getByText('Account deleted')).toBeVisible()

  // The deleted account can no longer authenticate.
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  // S-16 surfaces an action error in BOTH channels (inline <FormError> + a toast), so the text
  // now matches two elements — pin the inline form error (DOM-order first; the toast container
  // is mounted last in <body>) to dodge the strict-mode violation.
  await expect(page.getByText('Invalid login credentials').first()).toBeVisible()
  await expect(page).toHaveURL(/\/sign-in/)
})
