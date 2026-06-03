import { test, expect, type Page } from '@playwright/test'

// S-04 activity dashboard — UI shell smoke test. Data is dummy (deterministic) until the
// recall loop (S-03) is wired, so the rendered structure is stable to assert against.

const PASSWORD = 'password123'

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

async function signUp(page: Page, email: string) {
  await page.goto('/sign-up')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/dashboard')
}

test('renders both stat cards', async ({ page }) => {
  await signUp(page, uniqueEmail())
  await expect(page.getByText('Due today')).toBeVisible()
  await expect(page.getByText('Current streak')).toBeVisible()
  await expect(page.getByText('consecutive days with ≥1 review')).toBeVisible()
})

test('renders the 12-month heatmap grid', async ({ page }) => {
  await signUp(page, uniqueEmail())
  const grid = page.getByRole('img', { name: /Review activity heatmap/i })
  await expect(grid).toBeVisible()
  // 53 weeks × 7 weekdays = 371 cells.
  await expect(grid.locator('> div')).toHaveCount(371)
})

test('hovering a cell shows the count tooltip', async ({ page }) => {
  await signUp(page, uniqueEmail())
  const grid = page.getByRole('img', { name: /Review activity heatmap/i })
  // First column's Sunday is always an in-range (dated) cell.
  await grid.locator('> div').first().hover()
  await expect(page.getByRole('status')).toContainText(/reviews? ·|No reviews ·/)
})
