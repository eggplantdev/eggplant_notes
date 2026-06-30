import { test, expect } from '@playwright/test'

import { clientFor, signUp, uniqueEmail } from './helpers'

// S-07 acceptance path: stage 0..N memory cards inline on /notes/new and save them atomically
// with the note (one create_note_with_cards RPC transaction). Rows use the prompt AppField +
// the optional example field, which starts as a plain textarea; its "Add formatting" markdown
// editor (a CodeMirror island) is intentionally not driven here — the create page mounts one
// .cm-content for the note body, and upgrading a row would add more, breaking fillEditor's
// single-locator. Atomicity/highlight of code is covered by notes.spec.ts.

const noteIdFromUrl = (url: string) => url.match(/\/notes\/([0-9a-f-]+)$/)?.[1]

test('create a note with two memory cards inline, saved together', async ({ page }) => {
  const email = uniqueEmail('cnwc')
  await signUp(page, email)

  const title = `Inline checks ${Date.now()}`
  const q1 = 'What does SECURITY INVOKER mean?'
  const q2 = 'When does an FK abort the transaction?'

  await page.goto('/notes/new')
  await page.getByLabel('Title').fill(title)

  // Stage two checks, plus a third we then remove — proving removed rows aren't persisted (and
  // that removal works: an un-removed empty row would block the save on the prompt validator).
  await page.getByRole('button', { name: 'Add card' }).click()
  await page.getByRole('button', { name: 'Add card' }).click()
  await page.getByRole('button', { name: 'Add card' }).click()
  await page.getByLabel('Question').nth(0).fill(q1)
  await page.getByLabel('Question').nth(1).fill(q2)
  await page.getByLabel('Example (optional)').nth(0).fill('It runs as the calling user.')
  await page.getByRole('button', { name: 'Remove' }).last().click()
  await expect(page.getByLabel('Question')).toHaveCount(2)

  await page.getByRole('button', { name: 'Create note' }).click()

  // PRG: redirected to the new note's detail page (first action on a fresh prod server is slow).
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/, { timeout: 15_000 })
  const noteId = noteIdFromUrl(page.url())
  expect(noteId).toBeTruthy()

  // Both checks are attached and listed on the detail page (cards render as their prompt text via
  // AnimatedCardList's shadcn Cards, not <li> rows).
  await expect(page.getByText(q1)).toBeVisible()
  await expect(page.getByText(q2)).toBeVisible()

  // And both rows actually landed in the DB, scoped to this user (the atomic write committed both).
  const supabase = await clientFor(email)
  const { data, error } = await supabase
    .from('memory_cards')
    .select('prompt, example, note_id')
    .eq('note_id', noteId!)
  expect(error).toBeNull()
  expect(data).toHaveLength(2)
  expect(data?.map((r) => r.prompt).sort()).toEqual([q2, q1].sort())
})

test('a staged check with an empty question blocks the save', async ({ page }) => {
  await signUp(page, uniqueEmail('cnwc-block'))

  await page.goto('/notes/new')
  await page.getByLabel('Title').fill(`Blocked ${Date.now()}`)
  // Add a check but leave its question empty.
  await page.getByRole('button', { name: 'Add card' }).click()
  await page.getByRole('button', { name: 'Create note' }).click()

  // Save is blocked: inline error shows and we stay on /notes/new (no redirect, no row written).
  await expect(page.getByText('Question is required')).toBeVisible()
  await expect(page).toHaveURL(/\/notes\/new$/)
})

test('creating with zero checks behaves like a plain note', async ({ page }) => {
  const email = uniqueEmail('cnwc-zero')
  await signUp(page, email)

  const title = `No checks ${Date.now()}`
  await page.goto('/notes/new')
  await page.getByLabel('Title').fill(title)
  await page.getByRole('button', { name: 'Create note' }).click()

  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/, { timeout: 15_000 })
  const noteId = noteIdFromUrl(page.url())

  // No memory cards listed, and none in the DB for this note.
  const supabase = await clientFor(email)
  const { data, error } = await supabase.from('memory_cards').select('id').eq('note_id', noteId!)
  expect(error).toBeNull()
  expect(data).toHaveLength(0)
})
