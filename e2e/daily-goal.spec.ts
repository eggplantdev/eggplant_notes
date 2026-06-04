import { expect, test } from '@playwright/test'

import { signUp, uniqueEmail } from './helpers'

// Accessible name of the goal input (the <Label> text). Parens included so getByLabel matches.
const GOAL_FIELD = 'Daily goal (cards / day)'

test('set daily goal on settings → dashboard progress bar reflects it', async ({ page }) => {
  await signUp(page, uniqueEmail('daily-goal'))

  // A fresh user starts at the default goal (5) with no reviews today.
  await page.goto('/dashboard')
  await expect(page.getByText('0 / 5')).toBeVisible({ timeout: 15_000 })

  // Change the goal on settings; saving surfaces a success toast (the save-complete signal).
  await page.goto('/settings')
  await page.getByLabel(GOAL_FIELD).fill('20')
  await page.getByRole('button', { name: 'Save goal' }).click()
  await expect(page.getByText('Daily goal saved')).toBeVisible({ timeout: 15_000 })

  // Reload settings → the stored value is read back (write + read round-trip).
  await page.goto('/settings')
  await expect(page.getByLabel(GOAL_FIELD)).toHaveValue('20')

  // Dashboard bar label rescales to the new goal (revalidatePath('/dashboard') on save).
  await page.goto('/dashboard')
  await expect(page.getByText('0 / 20')).toBeVisible({ timeout: 15_000 })
})

test('rejects an invalid goal inline without writing', async ({ page }) => {
  await signUp(page, uniqueEmail('daily-goal-bad'))

  await page.goto('/settings')
  await page.getByLabel(GOAL_FIELD).fill('0')
  await page.getByRole('button', { name: 'Save goal' }).click()

  // Inline field error, no success toast, no write — the goal stays at the default.
  await expect(page.getByText('Goal must be at least 1')).toBeVisible()
  await page.goto('/dashboard')
  await expect(page.getByText('0 / 5')).toBeVisible({ timeout: 15_000 })
})
