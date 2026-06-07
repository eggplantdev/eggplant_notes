import { test, expect, type Page } from '@playwright/test'

import { attachCheck, clientFor, fillEditor, signUp, uniqueEmail } from './helpers'

// S-15 acceptance path: the subject view is now the docs-style single-pane view at
// /subjects/[id] (the continuous "subject-as-document" page was replaced). Opening a subject
// redirects to its first note; a persistent sidebar lists the notes (titles only) where each
// row navigates (Link) and reorders via a dedicated grip handle; the content pane server-renders
// one note's read-only body (Shiki-highlighted). Plus subject rename via ?edit, delete-detach,
// and a two-account isolation + F1 (cross-user assignment) negative control. Helpers in ./helpers.

const CODE_A = ['```ts', 'const a = 1', '```'].join('\n')

// The sidebar renders twice (desktop column + mobile sheet); at the default desktop viewport the
// desktop one (first in DOM) is visible. Scope all sidebar queries to it to avoid strict-mode
// duplicate matches.
function sidebar(page: Page) {
  return page.locator('nav[aria-label="Notes in this subject"]').first()
}

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
  await page.getByRole('combobox', { name: 'Subject' }).click()
  await page.getByRole('option', { name: subjectTitle, exact: true }).click()
  await page.getByRole('button', { name: 'Create note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/, { timeout: 15_000 })
}

test('docs view: open → first note, sidebar nav, handle reorder, delete-detach', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('subj'))
  const stamp = Date.now()

  // Create a subject → lands on it (empty → prompt). Capture its id from the URL.
  await page.goto('/subjects/new')
  await page.getByLabel('Title').fill(`Subject ${stamp}`)
  await page.getByRole('button', { name: 'Create subject' }).click()
  await expect(page).toHaveURL(/\/subjects\/[0-9a-f-]+$/, { timeout: 15_000 })
  const subjectUrl = page.url()

  // Assign two notes (A carries a code block, assigned first → ordered before B).
  const titleA = `Note A ${stamp}`
  const titleB = `Note B ${stamp}`
  await createAssignedNote(page, titleA, `Subject ${stamp}`, CODE_A)
  const checkPrompt = `Check ${stamp}`
  await attachCheck(page, checkPrompt) // on note A, to prove it survives subject delete
  await createAssignedNote(page, titleB, `Subject ${stamp}`)

  // Open the subject → redirects to the first note's pane; the sidebar lists both in order and
  // the active (first) note's code is Shiki-highlighted in the pane.
  await page.goto(subjectUrl)
  await expect(page).toHaveURL(/\/subjects\/[0-9a-f-]+\/[0-9a-f-]+$/, { timeout: 15_000 })
  const links = sidebar(page).locator('a[data-note-link]')
  await expect(links).toHaveCount(2)
  await expect(links.nth(0)).toHaveText(titleA)
  await expect(links.nth(1)).toHaveText(titleB)
  await expect(links.nth(0)).toHaveAttribute('aria-current', 'page') // first note active
  await expect(page.locator('pre.shiki')).toBeVisible()
  expect(await page.locator('pre.shiki span[style*="--shiki"]').count()).toBeGreaterThan(2)

  // Sidebar navigation: click note B → pane swaps, URL changes, active highlight moves to B.
  await links.nth(1).click()
  await expect(page.getByRole('heading', { name: titleB })).toBeVisible({ timeout: 15_000 })
  await expect(sidebar(page).locator('a[data-note-link]').nth(1)).toHaveAttribute(
    'aria-current',
    'page',
  )

  // Handle reorder: drag note A's grip handle below note B; reload; confirm sidebar order flipped.
  const rowA = sidebar(page).locator('li').filter({ hasText: titleA })
  const rowB = sidebar(page).locator('li').filter({ hasText: titleB })
  const handleA = rowA.getByRole('button', { name: 'Drag to reorder' })
  const h = await handleA.boundingBox()
  const b = await rowB.boundingBox()
  if (!h || !b) throw new Error('reorder handle/row not found')
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.move(b.x + b.width / 2, b.y + b.height + 4, { steps: 6 }) // overshoot past B
  await page.mouse.up()

  await page.goto(subjectUrl)
  const reordered = sidebar(page).locator('a[data-note-link]')
  await expect(reordered.nth(0)).toHaveText(titleB, { timeout: 15_000 })
  await expect(reordered.nth(1)).toHaveText(titleA)

  // Delete the subject (header action) → redirects to /subjects; member notes survive, unassigned.
  // Scope to the subject header — the open note's pane (article) also renders a Delete.
  await page
    .locator('header')
    .filter({ hasText: `Subject ${stamp}` })
    .getByRole('button', { name: 'Delete' })
    .click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL('/subjects', { timeout: 15_000 })

  await page.goto('/notes')
  await expect(page.getByText(titleA)).toBeVisible()
  await expect(page.getByText(titleB)).toBeVisible()

  // Note A's memory card survived the subject delete (detach, not cascade).
  await page.getByText(titleA).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/)
  await expect(page.getByText(checkPrompt)).toBeVisible({ timeout: 15_000 })
})

test('subject in-place edit: rename + description via ?edit, lands back on the subject', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('subj-edit'))
  const stamp = Date.now()

  await page.goto('/subjects/new')
  await page.getByLabel('Title').fill(`Subj ${stamp}`)
  await page.getByRole('button', { name: 'Create subject' }).click()
  await expect(page).toHaveURL(/\/subjects\/[0-9a-f-]+$/, { timeout: 15_000 })

  // The header Edit link drives ?edit; the index swaps to the SubjectForm in place.
  await page.getByRole('link', { name: 'Edit' }).click()
  await expect(page).toHaveURL(/\?edit$/)
  await expect(page.getByLabel('Title')).toBeVisible()
  await expect(page.getByLabel('Description (optional)')).toBeVisible()

  const renamed = `Subj ${stamp} renamed`
  const description = `Described ${stamp}`
  await page.getByLabel('Title').fill(renamed)
  await page.getByLabel('Description (optional)').fill(description)
  await page.getByRole('button', { name: 'Save changes' }).click()

  // Save redirects to the bare subject (no notes → empty prompt); header shows the new
  // title + description and the ?edit state is gone.
  await expect(page.getByRole('heading', { name: renamed })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(description)).toBeVisible()
  await expect(page).not.toHaveURL(/\?edit$/)
})

// Card Edit/Delete shortcuts on the subjects list mirror the notes list (S-17): each subject
// card carries Edit + Delete whose clicks must NOT trigger the card's own navigation. Edit jumps
// into the subject's ?edit form; Delete opens the shared confirm dialog (no nav) and removes the
// row; clicking the card body still opens the subject. "New note" is no longer on the card.
test('subjects list cards have working Edit/Delete shortcuts; card body still navigates', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('subj-list-actions'))
  const title = `List actions ${Date.now()}`

  await page.goto('/subjects/new')
  await page.getByLabel('Title').fill(title)
  await page.getByRole('button', { name: 'Create subject' }).click()
  await expect(page).toHaveURL(/\/subjects\/[0-9a-f-]+$/, { timeout: 15_000 })

  // The card no longer offers "New note" — that shortcut was removed when mirroring the notes view.
  await page.goto('/subjects')
  await expect(page.getByText(title)).toBeVisible()
  await expect(page.getByRole('button', { name: 'New note' })).toHaveCount(0)

  // Card body still navigates to the subject (no notes → bare subject page, no redirect).
  await page.getByText(title).click()
  await expect(page).toHaveURL(/\/subjects\/[0-9a-f-]+$/)

  // Edit shortcut → straight into the subject's ?edit form, not just the view.
  await page.goto('/subjects')
  await page.getByRole('button', { name: 'Edit' }).click()
  await expect(page).toHaveURL(/\/subjects\/[0-9a-f-]+\?edit$/)
  await expect(page.getByLabel('Title')).toBeVisible()

  // Delete shortcut → dialog opens WITHOUT navigating off the list, then confirm removes the row.
  await page.goto('/subjects')
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL('/subjects')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText(title)).toHaveCount(0, { timeout: 15_000 })
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
