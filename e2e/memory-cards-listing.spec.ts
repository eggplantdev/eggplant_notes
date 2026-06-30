import { test, expect, type Page } from '@playwright/test'

import { attachCheck, signUp, uniqueEmail } from './helpers'

// Acceptance path for the standalone /memory-cards listing (S-17):
//  1. Every owned memory card lists as a card showing its prompt + subject ("topic") chip +
//     source-note title.
//  2. The Subjects multiselect filters the list server-side (?subjects=<id> in the URL),
//     committed on popover close (the debounce's flush-on-close) — joining through notes.
//  3. The per-card Review button selects it into the in-place review panel (?review=<id>, no
//     navigation away), from which the source note stays reachable.
// Shared auth/check helpers live in ./helpers. Cards are NOT links — they carry a Review button; the
// list card is located by [data-slot=card] filtered to the prompt AND a Review button (the in-place
// review PANEL is also a card but has no Review button, so this disambiguates panel from list).

async function createSubject(page: Page, title: string): Promise<void> {
  await page.goto('/subjects/new')
  await page.getByLabel('Title').fill(title)
  await page.getByRole('button', { name: 'Create subject' }).click()
  await expect(page).toHaveURL(/\/subjects\/[0-9a-f-]+$/, { timeout: 15_000 })
}

// Create a note assigned to a subject (via the note-form picker) and land on its detail page.
async function createNoteInSubject(page: Page, title: string, subject: string): Promise<void> {
  await page.goto('/notes/new')
  await page.getByLabel('Title').fill(title)
  // /notes/new's SubjectSelect Combobox is unlabeled (name derives from the selected value); scope
  // via the sibling "Subject mode" radiogroup, matching standalone-memory-cards + subjects.spec.
  await page
    .getByRole('radiogroup', { name: 'Subject mode' })
    .locator('..')
    .getByRole('combobox')
    .click()
  await page.getByRole('option', { name: subject, exact: true }).click()
  await page.getByRole('button', { name: 'Create note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/, { timeout: 15_000 })
}

test('memory-cards listing: lists checks, filters by subject, card opens its review page', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('tc-list'))
  const stamp = Date.now()
  const subjA = `Alpha ${stamp}`
  const subjB = `Beta ${stamp}`
  const noteA = `Note A ${stamp}`
  const promptA = `What is a closure ${stamp}`
  const promptB = `What is a generator ${stamp}`

  await createSubject(page, subjA)
  await createSubject(page, subjB)

  // A check on a note in subject A, and one on a note in subject B.
  await createNoteInSubject(page, noteA, subjA)
  await attachCheck(page, promptA)
  await createNoteInSubject(page, `Note B ${stamp}`, subjB)
  await attachCheck(page, promptB)

  // A list card = a [data-slot=card] holding the prompt AND a Review button (the review panel is also
  // a card but has no Review button — this picks the LIST card, not the panel).
  const listCard = (prompt: string) =>
    page
      .locator('[data-slot="card"]')
      .filter({ hasText: prompt })
      .filter({ has: page.getByRole('button', { name: 'Review' }) })

  // (1) Both checks list, and card A carries its subject chip + source-note title.
  await page.goto('/memory-cards')
  await expect(listCard(promptA)).toBeVisible()
  await expect(listCard(promptB)).toBeVisible()
  await expect(listCard(promptA)).toContainText(subjA)
  await expect(listCard(promptA)).toContainText(noteA)

  // (2) Filter by subject A: open the Subjects multiselect, check A, close to flush the commit.
  await page.getByRole('combobox', { name: /Subjects/ }).click()
  await page.getByRole('option', { name: subjA, exact: true }).click()
  await page.keyboard.press('Escape')

  await expect(page).toHaveURL(/\?subjects=[0-9a-f-]+/, { timeout: 15_000 })
  await expect(listCard(promptA)).toBeVisible()
  await expect(listCard(promptB)).toHaveCount(0)

  // (3) Click the card's Review button → it's selected into the in-place panel (?review=<id>, no
  // navigation away); the source note stays reachable from the panel.
  await listCard(promptA).getByRole('button', { name: 'Review' }).click()
  await expect(page).toHaveURL(/[?&]review=[0-9a-f-]+/, { timeout: 15_000 })
  await expect(page.getByRole('link', { name: `From: ${noteA}` })).toBeVisible()
})
