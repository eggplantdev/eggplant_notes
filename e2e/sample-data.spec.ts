import { test, expect } from '@playwright/test'

import { signUp, uniqueEmail } from './helpers'

// S-12: the Load / Clear sample-data demo flow on a fresh account. Sign up → /notes shows the
// Load CTA in its empty state → Load → notes/subjects populate and the dashboard review teaser has
// a due card → Clear (from /settings) → account empty again, Load reappears. Targets the controls
// by data-testid (lessons.md); asserts on COMMITTED fixture content ("Immutability" — a note we
// own) and on the review teaser's Review link, not on UI copy. Self-seeds via fresh-per-test sign-up and
// asserts clean-slate state, so it must NOT share a session. Sign-up flake is environmental
// (lessons.md) — retries: 2 reruns from a brand-new account.

// A note title from the committed fixture (src/features/sample-data/sample-data.ts).
const FIXTURE_NOTE = 'Immutability'

test('load then clear sample data round-trips an empty account', async ({ page }) => {
  await signUp(page, uniqueEmail('sample-data'))

  // Brand-new account: /notes is empty and offers the Load CTA beside "Create a note".
  await page.goto('/notes')
  await expect(page.getByText('No notes yet', { exact: false })).toBeVisible()
  await expect(page.getByTestId('sample-data-load')).toBeVisible()

  // Load → the fixture lands under this user; the empty state is replaced by the note list.
  await page.getByTestId('sample-data-load').click()
  await expect(page.getByText(FIXTURE_NOTE)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('No notes yet', { exact: false })).toHaveCount(0)

  // Cards loaded with default scheduling (state=0, due_at=now) → all due now, so the dashboard
  // review teaser previews a due card with a "Review" link out (not the "All caught up" note).
  await page.goto('/dashboard')
  await expect(page.getByRole('link', { name: 'Review', exact: true })).toBeVisible({
    timeout: 15_000,
  })

  // Clear from settings (both controls always render — gating is on-demand via the actions).
  await page.goto('/settings')
  await page.getByTestId('sample-data-clear').click()
  // Wait for the action to settle before navigating — the click fires an async transition, so
  // the success toast is the completion signal (navigating first would race the delete).
  await expect(page.getByText('Sample data cleared', { exact: false })).toBeVisible({
    timeout: 15_000,
  })

  // Back to empty: /notes shows the empty state + Load again, and the review queue is drained.
  await page.goto('/notes')
  await expect(page.getByText('No notes yet', { exact: false })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('sample-data-load')).toBeVisible()
  await expect(page.getByText(FIXTURE_NOTE)).toHaveCount(0)

  await page.goto('/dashboard')
  await expect(page.getByText('All caught up', { exact: false })).toBeVisible({ timeout: 15_000 })
})
