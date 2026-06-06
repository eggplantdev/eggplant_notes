import { test, expect, type Page } from '@playwright/test'

import { attachCheck, signUp, uniqueEmail } from './helpers'

// Acceptance path for the standalone /memory-cards listing (S-17):
//  1. Every owned memory card lists as a card showing its prompt + subject ("topic") chip +
//     source-note title.
//  2. The Subjects multiselect filters the list server-side (?subjects=<id> in the URL),
//     committed on popover close (the debounce's flush-on-close) — joining through notes.
//  3. Clicking a card deep-links to its parent note at the exact check (#check-<id>).
// Shared auth/check helpers live in ./helpers.

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
  await page.getByRole('combobox', { name: 'Subject' }).click()
  await page.getByRole('option', { name: subject, exact: true }).click()
  await page.getByRole('button', { name: 'Create note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/, { timeout: 15_000 })
}

test('memory-cards listing: lists checks, filters by subject, card deep-links to its note', async ({
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

  // (1) Both checks list, and card A carries its subject chip + source-note title.
  await page.goto('/memory-cards')
  const cardA = page.getByRole('link').filter({ hasText: promptA })
  await expect(cardA).toBeVisible()
  await expect(page.getByRole('link').filter({ hasText: promptB })).toBeVisible()
  await expect(cardA).toContainText(subjA)
  await expect(cardA).toContainText(noteA)

  // (2) Filter by subject A: open the Subjects multiselect, check A, close to flush the commit.
  await page.getByRole('combobox', { name: /Subjects/ }).click()
  await page.getByRole('option', { name: subjA, exact: true }).click()
  await page.keyboard.press('Escape')

  await expect(page).toHaveURL(/\?subjects=[0-9a-f-]+/, { timeout: 15_000 })
  await expect(page.getByRole('link').filter({ hasText: promptA })).toBeVisible()
  await expect(page.getByRole('link').filter({ hasText: promptB })).toHaveCount(0)

  // (3) Click the card → its parent note, deep-linked to the exact check.
  await page.getByRole('link').filter({ hasText: promptA }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+#check-[0-9a-f-]+$/, { timeout: 15_000 })
  await expect(page.locator('li', { hasText: promptA })).toBeVisible()
})
