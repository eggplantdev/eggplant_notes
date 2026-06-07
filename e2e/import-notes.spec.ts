import { test, expect } from '@playwright/test'

import { signUp, uniqueEmail } from './helpers'

// Acceptance path for S-19 Phase 1 (deterministic markdown import):
//  1. Upload a markdown file on /import → it splits into notes at the chosen heading level.
//  2. Edit one note's title and skip another in the preview (the human-in-the-loop gate).
//  3. Commit into a NEW subject → land on that subject, with the kept (edited) notes present and
//     the skipped one absent.
// Shared auth helpers live in ./helpers.

test('import a markdown file into notes under a new subject', async ({ page }) => {
  await signUp(page, uniqueEmail('import'))
  const stamp = Date.now()
  const alpha = `Alpha ${stamp}`
  const beta = `Beta ${stamp}`
  const gamma = `Gamma ${stamp}`
  const alphaEdited = `Alpha Edited ${stamp}`
  const subject = `Imported ${stamp}`

  const markdown = [
    `# ${alpha}`,
    'alpha body',
    `# ${beta}`,
    'beta body',
    `# ${gamma}`,
    'gamma body',
  ].join('\n')

  await page.goto('/import')

  // (1) Upload the fixture; default split level is H1 → three notes.
  await page.getByTestId('import-file').setInputFiles({
    name: 'notes.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(markdown),
  })
  await page.getByTestId('import-level-h1').click()
  await expect(page.getByTestId('import-note-row')).toHaveCount(3)

  // (2) Edit the first note's title; skip the last note (Gamma) — split order is deterministic.
  await page.getByTestId('import-note-title').first().fill(alphaEdited)
  await page.getByTestId('import-note-skip').last().click()

  // (3) Commit into a new subject.
  await page.getByTestId('import-subject-new-mode').click()
  await page.getByTestId('import-subject-title').fill(subject)
  await page.getByTestId('import-commit').click()

  await expect(page).toHaveURL(/\/subjects\/[0-9a-f-]+/, { timeout: 15_000 })
  await expect(page.getByText(alphaEdited)).toBeVisible()
  await expect(page.getByText(beta)).toBeVisible()
  await expect(page.getByText(gamma)).toHaveCount(0)
})
