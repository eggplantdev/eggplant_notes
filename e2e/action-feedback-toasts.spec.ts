import { expect, test } from '@playwright/test'

import { signUp, uniqueEmail } from './helpers'

// S-16 acceptance: every mutation surfaces a toast. These specs cover the two seams that produce
// a NAVIGATED outcome — the post-redirect reader (?toast=<key> → <ActionToast>) and a return-only
// "silent success" form. The imperative seam's error scream (reorder failure) and optimistic
// revert were verified manually with Playwright during implementation and are unit-tested at the
// toastResult/toastActionResult branch level (src/__tests__/toast-result.test.ts); they aren't
// re-driven here because forcing a server-action failure mid-E2E isn't clean.
//
// Toasts auto-close after 2s, so each assertion runs immediately after the navigation settles.

test('post-redirect toasts: create shows "Note saved", refresh does not re-toast, delete shows "Note deleted"', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('toast'))
  const title = `Toast note ${Date.now()}`

  // Create → redirect to the new note with ?toast=note-saved; <ActionToast> toasts then strips it.
  await page.goto('/notes/new')
  await page.getByLabel('Title').fill(title)
  await page.getByRole('button', { name: 'Create note' }).click()
  await expect(page.getByText('Note saved')).toBeVisible({ timeout: 15_000 })
  // The flag is stripped after firing — URL is the bare note path, no ?toast left behind.
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/)

  // 4.7 — reloading the stripped URL must NOT re-toast (the param is gone).
  await page.reload()
  await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Note saved')).toHaveCount(0)

  // Delete → redirect to /notes with ?toast=note-deleted.
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL(/\/notes(\?|$)/, { timeout: 15_000 })
  await expect(page.getByText('Note deleted')).toBeVisible()
})

test('silent-success form: adding a memory card toasts "Check added"', async ({ page }) => {
  await signUp(page, uniqueEmail('toast-check'))

  await page.goto('/notes/new')
  await page.getByLabel('Title').fill(`Check toast ${Date.now()}`)
  await page.getByRole('button', { name: 'Create note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/, { timeout: 15_000 })

  // The add-check form returns {success:true} with no redirect — previously a silent success.
  await page.getByLabel('Question').fill('What does first-class function mean?')
  await page.getByRole('button', { name: 'Add memory card' }).click()
  await expect(page.getByText('Check added')).toBeVisible({ timeout: 15_000 })
})
