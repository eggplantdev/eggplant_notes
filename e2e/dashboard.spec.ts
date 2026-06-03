import { test, expect } from '@playwright/test'

import { signUp, uniqueEmail } from './helpers'

// S-04 activity dashboard — UI shell smoke test. Data is dummy (deterministic) until the
// recall loop (S-03) is wired, so the rendered structure is stable to assert against.

test('renders both stat cards', async ({ page }) => {
  await signUp(page, uniqueEmail('dash'))
  await expect(page.getByText('Due today')).toBeVisible()
  await expect(page.getByText('Current streak')).toBeVisible()
  await expect(page.getByText('consecutive days with ≥1 review')).toBeVisible()
})

test('renders the 12-month heatmap grid', async ({ page }) => {
  await signUp(page, uniqueEmail('dash'))
  const grid = page.getByRole('img', { name: /Review activity heatmap/i })
  await expect(grid).toBeVisible()
  // 53 weeks × 7 weekdays = 371 cells.
  await expect(grid.locator('> div')).toHaveCount(371)
})

test('hovering a cell shows the count tooltip', async ({ page }) => {
  await signUp(page, uniqueEmail('dash'))
  const grid = page.getByRole('img', { name: /Review activity heatmap/i })
  // First column's Sunday is always an in-range (dated) cell.
  await grid.locator('> div').first().hover()
  await expect(page.getByRole('status')).toContainText(/reviews? ·|No reviews ·/)
})
