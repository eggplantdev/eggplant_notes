import { test, expect } from '@playwright/test'

import { attachCheck, createNote, signUp, uniqueEmail } from './helpers'

// S-08: from a due recall card on the /memory-cards review panel, the user jumps to the card's
// source note in one action. Sign up → create a note (capture its URL) → attach a check (due_at
// defaults to now → immediately due) → open /memory-cards → assert the card header links to the
// note by title → click → land on the note detail page. Fresh-per-test sign-up (asserts a clean single due card, so
// it must not share a session — see lessons.md). Treat any sign-up flake as environmental.
test('a due review card links to its source note by title', async ({ page }) => {
  const email = uniqueEmail('card-to-note')
  await signUp(page, email)

  const title = `Closures deep-dive ${Date.now()}`
  await createNote(page, title)
  const noteUrl = page.url()

  await attachCheck(page, `What is a closure? ${Date.now()}`)

  // Scope to the review panel: the source-note link lives in its card header (the list rows below
  // don't render one).
  await page.goto('/memory-cards')
  const sourceLink = page.locator('#review-panel').getByRole('link', { name: `From: ${title}` })
  await expect(sourceLink).toBeVisible({ timeout: 15_000 })

  await sourceLink.click()
  await expect(page).toHaveURL(noteUrl)
})
