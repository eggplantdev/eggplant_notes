import { test, expect, type Page } from '@playwright/test'

import { signUp, uniqueEmail } from './helpers'

// Acceptance path for the subject-tied note creation + server-side subject ("topic") filter:
//  1. "New note" from a subject's detail page lands on /notes/new?subject=<id> with that
//     subject pre-selected, so the saved note is already assigned (proven via the subject's
//     master-detail view: opening it redirects to the first note and lists it in the sidebar).
//  2. The /notes list shows each note's subject as a chip on its card.
//  3. The Subjects multiselect filters the list server-side (?subjects=<id> in the URL),
//     committed on popover close (the debounce's flush-on-close).
// Shared auth helpers live in ./helpers.

// Create a subject via the UI and return its detail URL (carries the id).
async function createSubject(page: Page, title: string): Promise<string> {
  await page.goto('/subjects/new')
  await page.getByLabel('Title').fill(title)
  await page.getByRole('button', { name: 'Create subject' }).click()
  await expect(page).toHaveURL(/\/subjects\/[0-9a-f-]+$/, { timeout: 15_000 })
  return page.url()
}

test('create note tied to a subject + filter the notes list by subject', async ({ page }) => {
  await signUp(page, uniqueEmail('filter'))
  const stamp = Date.now()
  const subjA = `Alpha ${stamp}`
  const subjB = `Beta ${stamp}`
  const noteA = `Note A ${stamp}`
  const noteB = `Note B ${stamp}`

  // Two subjects.
  const subjAUrl = await createSubject(page, subjA)
  await createSubject(page, subjB)

  // (1) Create note A from subject A's detail page → pre-tied to A (no manual picker step).
  await page.goto(subjAUrl)
  // The detail view's notes column carries "Add note to this subject" → /notes/new?subject=<id>
  // (an empty subject also shows a "New note" empty-state CTA to the same place; either works).
  await page.getByRole('link', { name: 'Add note to this subject' }).click()
  await expect(page).toHaveURL(/\/notes\/new\?subject=[0-9a-f-]+$/)
  await page.getByLabel('Title').fill(noteA)
  await page.getByRole('button', { name: 'Create note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/, { timeout: 15_000 })

  // Pre-tie proof: opening the subject redirects to its first note (master-detail list+content
  // view) and lists note A in the "Notes in this subject" sidebar.
  await page.goto(subjAUrl)
  await expect(page).toHaveURL(/\/subjects\/[0-9a-f-]+\/[0-9a-f-]+/, { timeout: 15_000 })
  await expect(
    page
      .getByRole('navigation', { name: 'Notes in this subject' })
      .getByRole('link', { name: noteA }),
  ).toBeVisible({ timeout: 15_000 })

  // Create note B assigned to subject B via the note-form picker. SubjectSelect's combobox is
  // unlabeled (its accessible name is the selected value, "None"), so scope to it via the sibling
  // "Subject mode" radiogroup rather than by name — same pattern as subjects.spec's createAssignedNote.
  await page.goto('/notes/new')
  await page.getByLabel('Title').fill(noteB)
  await page
    .getByRole('radiogroup', { name: 'Subject mode' })
    .locator('..')
    .getByRole('combobox')
    .click()
  await page.getByRole('option', { name: subjB, exact: true }).click()
  await page.getByRole('button', { name: 'Create note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/, { timeout: 15_000 })

  // (2) Both notes list with their subject chips.
  await page.goto('/notes')
  const cardA = page.getByRole('link').filter({ hasText: noteA })
  const cardB = page.getByRole('link').filter({ hasText: noteB })
  await expect(cardA).toBeVisible()
  await expect(cardB).toBeVisible()
  await expect(cardA).toContainText(subjA)
  await expect(cardB).toContainText(subjB)

  // (3) Filter by subject A: open the Subjects multiselect, check A, close to flush the commit.
  await page.getByRole('combobox', { name: /Subjects/ }).click()
  await page.getByRole('option', { name: subjA, exact: true }).click()
  await page.keyboard.press('Escape')

  // URL carries the filter; only note A remains.
  await expect(page).toHaveURL(/\?subjects=[0-9a-f-]+/, { timeout: 15_000 })
  await expect(page.getByRole('link').filter({ hasText: noteA })).toBeVisible()
  await expect(page.getByRole('link').filter({ hasText: noteB })).toHaveCount(0)
})
