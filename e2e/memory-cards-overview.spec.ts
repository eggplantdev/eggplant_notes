import { test, expect } from '@playwright/test'

import { attachCheck, createNote, signUp, uniqueEmail } from './helpers'

// Regression guard for the Cards-overview chart slice. The "Cards overview" panel on
// /memory-cards renders two radial charts (FSRS state mix + maturity split). The bug this
// guards: the charts collapsed to a 0×0 container and rendered nothing. It also locks in the
// accessibility readout (counts as text, since the rings show them only visually / on hover)
// and the Mature/Young tooltip trigger. A freshly created card is New + Young, so the counts
// are deterministic: New:1 / Young:1, everything else 0.
test('memory-cards overview: renders both radial charts with accessible text counts', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('mc-overview'))
  const stamp = Date.now()
  await createNote(page, `Overview note ${stamp}`)
  await attachCheck(page, `What is a thunk ${stamp}`)

  await page.goto('/memory-cards')

  // Panel + both axes present.
  await expect(page.getByText('Cards overview')).toBeVisible()
  await expect(page.getByText('By state')).toBeVisible()
  await expect(page.getByText('By maturity')).toBeVisible()

  // Both charts actually render an SVG surface (the 0×0-container bug rendered none).
  await expect(page.locator('.recharts-surface')).toHaveCount(2)

  // Mature/Young explanation is reachable as an accessible tooltip trigger.
  await expect(page.getByRole('button', { name: 'What do Mature and Young mean?' })).toBeVisible()

  // Counts exposed as text for screen-reader / non-hover users (sr-only → attached, not visible).
  await expect(page.getByText('New: 1')).toBeAttached()
  await expect(page.getByText('Mature: 0')).toBeAttached()
  await expect(page.getByText('Young: 1')).toBeAttached()
})
