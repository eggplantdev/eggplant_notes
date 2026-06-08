import { test, expect } from '@playwright/test'

import { attachCheck, createNote, signUp, uniqueEmail } from './helpers'

// memory-card-review-page (queue-advance iteration). RISK: the standalone /memory-cards/[id] review
// page must walk the DUE QUEUE — after rating a due card it advances to the NEXT due card, and shows
// "All caught up" IN PLACE when the queue empties. This crosses real boundaries the layer below
// can't prove together: the rate Server Action records the review, asks getDueQueue for the soonest
// remaining due card, and the client router.pushes to /memory-cards/<nextId> (SSR re-render). A
// regression to the old "stay on the rated card" behavior, or a failure to surface caught-up, is
// invisible to unit/integration tests. Self-seeds via real UI sign-up + two immediately-due cards;
// fresh-per-test (mutation), unique prompts. Locators: unique injected prompt text + role; URL
// assertions because the navigation IS the behavior under test (lessons.md:119,141).

const cardIdFromUrl = (url: string) => url.match(/\/memory-cards\/([0-9a-f-]+)(?:$|\?)/)?.[1]

test('rating a due card advances to the next due card, then shows caught-up in place', async ({
  page,
}) => {
  const email = uniqueEmail('mc-review-advance')
  await signUp(page, email)

  // A note with two memory cards — both default due_at = now, so both are immediately due.
  await createNote(page, `Review host ${Date.now()}`)
  const promptA = `Queue card A ${Date.now()}`
  const promptB = `Queue card B ${Date.now()}`
  await attachCheck(page, promptA)
  await attachCheck(page, promptB)

  // Open the listing and enter one card's review page.
  await page.goto('/memory-cards')
  await page.getByRole('link', { name: promptA }).click()
  await expect(page).toHaveURL(/\/memory-cards\/[0-9a-f-]+$/, { timeout: 15_000 })
  const firstId = cardIdFromUrl(page.url())
  expect(firstId, 'opened a card detail page').toBeTruthy()

  // Rate Good → the queue advances to the OTHER due card's page (a different id), not a refresh of
  // the just-rated card.
  await page.getByRole('button', { name: /Good/ }).click()
  await expect.poll(() => cardIdFromUrl(page.url()), { timeout: 15_000 }).not.toBe(firstId)
  await expect(page).toHaveURL(/\/memory-cards\/[0-9a-f-]+$/)
  const secondId = cardIdFromUrl(page.url())

  // Rate the last due card → queue empties → caught-up shown IN PLACE (no navigation away).
  await page.getByRole('button', { name: /Good/ }).click()
  await expect(page.getByText('All caught up', { exact: false })).toBeVisible({ timeout: 15_000 })
  expect(cardIdFromUrl(page.url()), 'caught-up stays on the rated card url').toBe(secondId)
})
