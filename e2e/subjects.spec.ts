import { test, expect, type Page } from '@playwright/test'

import { attachCheck, clientFor, fillEditor, signUp, uniqueEmail } from './helpers'

// S-06 acceptance path: create a subject, rename it, assign notes via the note form, read the
// subject as one ordered document (Shiki-highlighted, per-section note links), drag-reorder the
// notes (persists across reload), and delete the subject (member notes + their topic checks
// survive, unassigned). Plus a two-account isolation + F1 (cross-user assignment) negative
// control. Shared auth/editor/client helpers live in ./helpers.

const CODE_A = ['```ts', 'const a = 1', '```'].join('\n')

// Create a note already assigned to a subject, via the note form's subject picker. Lands on the
// note detail page. `content` may carry a code fence for the Shiki assertion.
async function createAssignedNote(
  page: Page,
  title: string,
  subjectTitle: string,
  content?: string,
) {
  await page.goto('/notes/new')
  await page.getByLabel('Title').fill(title)
  if (content) await fillEditor(page, content)
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: subjectTitle, exact: true }).click()
  await page.getByRole('button', { name: 'Create note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/, { timeout: 15_000 })
}

test('subject lifecycle: create, rename, assign + read as document, reorder, delete-detach', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('subj'))
  const stamp = Date.now()

  // Create a subject → lands on its detail page; capture its id from the URL.
  await page.goto('/subjects/new')
  await page.getByLabel('Title').fill(`Subject ${stamp}`)
  await page.getByRole('button', { name: 'Create subject' }).click()
  await expect(page).toHaveURL(/\/subjects\/[0-9a-f-]+$/, { timeout: 15_000 })
  const subjectUrl = page.url()

  // Rename it.
  const renamed = `Subject ${stamp} renamed`
  await page.getByRole('link', { name: 'Edit' }).click()
  await page.getByLabel('Title').fill(renamed)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('heading', { name: renamed })).toBeVisible({ timeout: 15_000 })

  // Assign two notes to it via the note-form picker (note A carries a code block).
  const titleA = `Note A ${stamp}`
  const titleB = `Note B ${stamp}`
  await createAssignedNote(page, titleA, renamed, CODE_A)
  // Attach a topic check to note A so we can prove it survives the subject delete.
  const checkPrompt = `Check ${stamp}`
  await attachCheck(page, checkPrompt)
  await createAssignedNote(page, titleB, renamed)

  // Subject-as-document: both notes render in order (A before B — A assigned first), the code
  // block is Shiki-highlighted, and each section title links to the note's own page.
  await page.goto(subjectUrl)
  const headings = page.locator('main section h2 a')
  await expect(headings).toHaveCount(2)
  await expect(headings.nth(0)).toHaveText(titleA)
  await expect(headings.nth(1)).toHaveText(titleB)
  await expect(headings.nth(0)).toHaveAttribute('href', /\/notes\/[0-9a-f-]+$/)
  await expect(page.locator('pre.shiki')).toBeVisible()
  expect(await page.locator('pre.shiki span[style*="--shiki"]').count()).toBeGreaterThan(2)

  // Drag note A's ToC row below note B, then reload and confirm the new order persisted.
  const rowA = page.getByRole('listitem').filter({ hasText: titleA })
  const rowB = page.getByRole('listitem').filter({ hasText: titleB })
  const a = await rowA.boundingBox()
  const b = await rowB.boundingBox()
  if (!a || !b) throw new Error('reorder rows not found')
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.move(b.x + b.width / 2, b.y + b.height + 4, { steps: 6 }) // overshoot past B
  await page.mouse.up()

  await page.goto(subjectUrl)
  await expect(headings.nth(0)).toHaveText(titleB, { timeout: 15_000 })
  await expect(headings.nth(1)).toHaveText(titleA)

  // Delete the subject → redirects to /subjects; member notes survive, now unassigned.
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL('/subjects', { timeout: 15_000 })

  await page.goto('/notes')
  await expect(page.getByText(titleA)).toBeVisible()
  await expect(page.getByText(titleB)).toBeVisible()

  // Note A's topic check survived the subject delete (detach, not cascade).
  await page.getByText(titleA).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/)
  await expect(page.getByText(checkPrompt)).toBeVisible({ timeout: 15_000 })
})

test('subjects are isolated by account, and a note cannot be assigned to a foreign subject (F1)', async ({
  browser,
}) => {
  const emailA = uniqueEmail('subj-iso-a')
  const emailB = uniqueEmail('subj-iso-b')

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  await signUp(await ctxA.newPage(), emailA)
  await signUp(await ctxB.newPage(), emailB)
  await ctxA.close()
  await ctxB.close()

  const supaA = await clientFor(emailA)
  const supaB = await clientFor(emailB)

  // A seeds a subject and a note.
  const subj = await supaA
    .from('subjects')
    .insert({ title: `iso subject ${Date.now()}` })
    .select('id')
    .single()
  expect(subj.error, 'A subject insert failed').toBeNull()
  const aSubjectId = subj.data!.id

  const bNote = await supaB
    .from('notes')
    .insert({ title: `B note ${Date.now()}` })
    .select('id')
    .single()
  expect(bNote.error, 'B note insert failed').toBeNull()
  const bNoteId = bNote.data!.id

  // Isolation: B cannot see A's subject (RLS), confirmed as a negative control (not a typo).
  const ownRead = await supaA.from('subjects').select('id').eq('id', aSubjectId)
  expect(ownRead.data?.length, 'A should see its own subject').toBe(1)
  const foreignRead = await supaB.from('subjects').select('id').eq('id', aSubjectId)
  expect(foreignRead.error, 'B select should not error (just empty)').toBeNull()
  expect(foreignRead.data?.length, 'LEAK: B sees A subject').toBe(0)

  // F1: B cannot point its own note at A's subject — the extended notes with-check rejects it
  // at the DB even though both the note (B's) and the FK target (A's subject) exist.
  const assign = await supaB
    .from('notes')
    .update({ subject_id: aSubjectId })
    .eq('id', bNoteId)
    .select('id')
  expect(assign.error, 'F1 BREACH: B assigned its note to A subject').not.toBeNull()
})
