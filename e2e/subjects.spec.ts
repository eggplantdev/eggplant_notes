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
  // SubjectSelect defaults to "Existing subject" mode; its Combobox is unlabeled (name comes from the
  // selected value, "None"), so scope to it via the sibling "Subject mode" radiogroup, not by name.
  await page
    .getByRole('radiogroup', { name: 'Subject mode' })
    .locator('..')
    .getByRole('combobox')
    .click()
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

  // Delete the subject → redirects to /subjects; member notes survive, unassigned. The subject's
  // delete control is the uniquely-named "Delete subject" button (the open note's pane renders a
  // bare "Delete"), so target it directly — it no longer lives inside a <header> element.
  await page.getByRole('button', { name: 'Delete subject' }).click()
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

  // Editing no longer redirects off ?edit (stays in place + toasts). Leave edit mode via Cancel →
  // the read view header shows the new title + description and the ?edit state is gone.
  await expect(page.getByText('Subject saved')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('link', { name: 'Cancel' }).click()
  await expect(page).not.toHaveURL(/\?edit$/)
  await expect(page.getByRole('heading', { name: renamed })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(description)).toBeVisible()
})

// subjects-picker-detail-view: the standalone /subjects card list is gone. /subjects no longer
// redirects — it shows a picker (or the empty state when there are none) and only navigates on an
// explicit pick, avoiding the chained-redirect spinner flash. Within the detail view, a switcher
// Combobox in the eyebrow navigates between subjects, and "Delete subject" lands back on the
// /subjects picker (not the next subject). Covers the routing risk: pick-to-navigate, switch,
// delete-to-picker, delete-to-empty, create-from-empty.
test('subjects picker + detail switcher: pick, switch, delete-to-picker, empty state, create-first', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('subj-switch'))
  const stamp = Date.now()

  // Empty account: /subjects is not a list — it shows the "no subjects" empty state.
  await page.goto('/subjects')
  await expect(page).toHaveURL('/subjects')
  await expect(page.getByText('No subjects yet.')).toBeVisible()

  // Two subjects.
  await page.goto('/subjects/new')
  await page.getByLabel('Title').fill(`Alpha ${stamp}`)
  await page.getByRole('button', { name: 'Create subject' }).click()
  await expect(page).toHaveURL(/\/subjects\/[0-9a-f-]+$/, { timeout: 15_000 })
  const alphaUrl = page.url()

  await page.goto('/subjects/new')
  await page.getByLabel('Title').fill(`Beta ${stamp}`)
  await page.getByRole('button', { name: 'Create subject' }).click()
  await expect(page).toHaveURL(/\/subjects\/[0-9a-f-]+$/, { timeout: 15_000 })
  const betaUrl = page.url()

  // /subjects stays put and shows the picker (the only combobox on the landing). Picking Beta
  // navigates into its detail.
  await page.goto('/subjects')
  await expect(page).toHaveURL('/subjects')
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: `Beta ${stamp}`, exact: true }).click()
  await expect(page).toHaveURL(betaUrl, { timeout: 15_000 })

  // The switcher (the only combobox in the detail eyebrow) reads the current subject and navigates
  // on pick: Beta → Alpha.
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: `Alpha ${stamp}`, exact: true }).click()
  await expect(page).toHaveURL(alphaUrl, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: `Alpha ${stamp}` })).toBeVisible()

  // Delete the current subject (Alpha) → delete lands on the /subjects picker (no auto-advance).
  // Beta remains; pick it from the picker to continue.
  await page.getByRole('button', { name: 'Delete subject' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL('/subjects', { timeout: 15_000 })
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: `Beta ${stamp}`, exact: true }).click()
  await expect(page).toHaveURL(betaUrl, { timeout: 15_000 })

  // Delete the last subject (Beta) → /subjects picker has nothing to offer → empty state.
  await page.getByRole('button', { name: 'Delete subject' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL('/subjects', { timeout: 15_000 })
  await expect(page.getByText('No subjects yet.')).toBeVisible()

  // Empty state CTA → create → lands on the new subject's detail.
  await page.getByRole('link', { name: 'Create your first subject' }).click()
  await expect(page).toHaveURL('/subjects/new')
  await page.getByLabel('Title').fill(`Gamma ${stamp}`)
  await page.getByRole('button', { name: 'Create subject' }).click()
  await expect(page).toHaveURL(/\/subjects\/[0-9a-f-]+$/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: `Gamma ${stamp}` })).toBeVisible()
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
