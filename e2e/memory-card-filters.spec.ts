import { test, expect } from '@playwright/test'

import { clientFor, signUp, uniqueEmail } from './helpers'

// Acceptance path for the server-side State + Maturity filters on /memory-cards (Phase 3 of
// memory-card-state-maturity-filters; test-plan §3 Phase 6).
//
// Every card created through the UI is state=0 (New) + stability=0 (Young), so distinct states
// and maturities can't be produced via clicks without running FSRS cycles. Sign-up still goes
// through the real UI (auth-path coverage), but the cards are seeded through an authenticated
// supabase-js client (lessons.md) with controlled `state` + `stability`. Maturity is derived:
// Mature = stability >= MATURE_STABILITY_DAYS (21), Young = below it.
//
// Filters are targeted by data-testid (filter-state / filter-maturity); assertions key off the
// seeded prompts (data we control) + the URL, never copy (lessons.md selector discipline).

test('memory-cards: State + Maturity filters narrow server-side and AND-compose', async ({
  page,
}) => {
  const email = uniqueEmail('mc-filter')
  await signUp(page, email)

  const stamp = Date.now()
  const newYoung = `NewYoung ${stamp}` // state 0, young
  const reviewMature = `ReviewMature ${stamp}` // state 2, mature
  const reviewYoung = `ReviewYoung ${stamp}` // state 2, young

  // Seed three standalone cards (note_id null; user_id defaults to auth.uid(), RLS-scoped).
  const supabase = await clientFor(email)
  const { error } = await supabase.from('memory_cards').insert([
    { prompt: newYoung, state: 0, stability: 0 },
    { prompt: reviewMature, state: 2, stability: 30 },
    { prompt: reviewYoung, state: 2, stability: 5 },
  ])
  expect(error, 'seed insert failed').toBeNull()

  const row = (text: string) => page.getByRole('link').filter({ hasText: text })

  // Baseline — all three list.
  await page.goto('/memory-cards')
  await expect(row(newYoung)).toBeVisible()
  await expect(row(reviewMature)).toBeVisible()
  await expect(row(reviewYoung)).toBeVisible()

  // State = Review narrows to the two Review-state cards; the New card drops.
  await page.getByTestId('filter-state').click()
  await page.getByRole('option', { name: 'Review', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/[?&]state=2(&|$)/, { timeout: 15_000 })
  await expect(row(reviewMature)).toBeVisible()
  await expect(row(reviewYoung)).toBeVisible()
  await expect(row(newYoung)).toHaveCount(0)

  // Adding Maturity = Mature composes (AND) with State: only the mature Review card survives.
  await page.getByTestId('filter-maturity').click()
  await page.getByRole('option', { name: 'Mature', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/[?&]maturity=mature(&|$)/, { timeout: 15_000 })
  await expect(row(reviewMature)).toBeVisible()
  await expect(row(reviewYoung)).toHaveCount(0)
  await expect(row(newYoung)).toHaveCount(0)

  // Deep-linking the composed filter loads pre-filtered (shareable / back-forward safe).
  await page.goto('/memory-cards?state=2&maturity=mature')
  await expect(row(reviewMature)).toBeVisible()
  await expect(row(reviewYoung)).toHaveCount(0)
  await expect(row(newYoung)).toHaveCount(0)
})
