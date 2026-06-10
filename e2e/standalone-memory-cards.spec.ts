import { test, expect, type Page } from '@playwright/test'

import { attachCheck, clientFor, createNote, signUp, uniqueEmail } from './helpers'

// standalone-memory-cards: cards decoupled from notes. A card owns its subject; the note link is
// optional source context. Core invariant: while a card is LINKED, its subject equals its note's,
// so changing either side resolves to move-or-unlink. These specs self-seed via the UI and assert
// the data model through an authenticated supabase-js client (lessons: signInWithPassword, not
// cookie reuse). Fresh-per-test sign-up — each asserts exact row counts, so no shared session.

async function createSubject(page: Page, title: string) {
  await page.goto('/subjects/new')
  await page.getByLabel('Title').fill(title)
  await page.getByRole('button', { name: 'Create subject' }).click()
  // Creating a subject redirects to its detail page (/subjects/<id>), not the list.
  await expect(page).toHaveURL(/\/subjects\/[0-9a-f-]+/, { timeout: 15_000 })
}

test('create a standalone card with no subject — lands on /memory-cards, no phantom note', async ({
  page,
}) => {
  const email = uniqueEmail('mc-standalone')
  await signUp(page, email)

  await page.goto('/memory-cards/new')
  const prompt = `Standalone Q ${Date.now()}`
  await page.getByLabel('Question').fill(prompt)
  await page.getByTestId('card-form-submit').click()

  await expect(page).toHaveURL(/\/memory-cards(\?|$)/, { timeout: 15_000 })
  await expect(page.getByText(prompt)).toBeVisible()

  // The card exists with no note, and /notes was never polluted with a phantom note.
  const db = await clientFor(email)
  const cards = await db.from('memory_cards').select('note_id, subject_id, prompt')
  expect(cards.data).toEqual([{ note_id: null, subject_id: null, prompt }])
  const notes = await db.from('notes').select('id', { count: 'exact', head: true })
  expect(notes.count).toBe(0)
})

test('a card added from a note can be unlinked from the card edit page and survives standalone', async ({
  page,
}) => {
  const email = uniqueEmail('mc-unlink')
  await signUp(page, email)
  await createNote(page, `Note ${Date.now()}`)
  const prompt = `Linked Q ${Date.now()}`
  await attachCheck(page, prompt)

  // Open the unified edit route for the card, then drop its note link.
  await page.goto('/memory-cards')
  await page.getByRole('button', { name: 'Edit' }).first().click()
  await expect(page).toHaveURL(/\/memory-cards\/[0-9a-f-]+\/edit$/, { timeout: 15_000 })
  await expect(page.getByTestId('card-unlink')).toBeVisible()
  await page.getByTestId('card-unlink').click()

  // The card survives with note_id cleared; the note itself is untouched.
  const db = await clientFor(email)
  await expect
    .poll(async () => (await db.from('memory_cards').select('note_id')).data?.[0]?.note_id)
    .toBeNull()
  const notes = await db.from('notes').select('id', { count: 'exact', head: true })
  expect(notes.count).toBe(1)
})

test("changing a note's subject moves a linked card to the new subject (per-card dialog)", async ({
  page,
}) => {
  const email = uniqueEmail('mc-move')
  await signUp(page, email)
  const srcTitle = `Src ${Date.now()}`
  const destTitle = `Dest ${Date.now()}-d`
  await createSubject(page, srcTitle)
  await createSubject(page, destTitle)

  // Note under the SOURCE subject, with one linked card (seeded with the note's subject).
  await page.goto('/notes/new')
  await page.getByLabel('Title').fill(`Note ${Date.now()}`)
  await page.getByRole('combobox', { name: 'Subject' }).click()
  await page.getByRole('option', { name: srcTitle, exact: true }).click()
  await page.getByRole('button', { name: 'Create note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/, { timeout: 15_000 })
  const noteUrl = page.url()
  await attachCheck(page, `Linked Q ${Date.now()}`)

  // Re-file the note to the destination subject → per-card dialog → Save (default Move).
  await page.goto(`${noteUrl}?edit=note`)
  await page.getByRole('combobox', { name: 'Subject' }).click()
  await page.getByRole('option', { name: destTitle, exact: true }).click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.getByTestId('move-cards-confirm').click()

  // The card followed the note: its subject is the destination, and it is still linked.
  const db = await clientFor(email)
  const dest = await db.from('subjects').select('id').eq('title', destTitle).single()
  await expect
    .poll(async () => (await db.from('memory_cards').select('subject_id')).data?.[0]?.subject_id)
    .toBe(dest.data?.id)
  const card = await db.from('memory_cards').select('note_id').single()
  expect(card.data?.note_id).not.toBeNull()
})

test('a standalone card can be linked to an existing note and adopts the note’s subject', async ({
  page,
}) => {
  const email = uniqueEmail('mc-link')
  await signUp(page, email)

  // A subject with a note filed under it.
  const subjectTitle = `Subj ${Date.now()}`
  await createSubject(page, subjectTitle)
  const noteTitle = `Note ${Date.now()}`
  await page.goto('/notes/new')
  await page.getByLabel('Title').fill(noteTitle)
  // SubjectSelect's Combobox is unlabeled (its name comes from the selected value); scope to it via
  // the sibling "Subject mode" radiogroup, matching createAssignedNote in subjects.spec.ts.
  await page
    .getByRole('radiogroup', { name: 'Subject mode' })
    .locator('..')
    .getByRole('combobox')
    .click()
  await page.getByRole('option', { name: subjectTitle, exact: true }).click()
  await page.getByRole('button', { name: 'Create note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/, { timeout: 15_000 })

  // A standalone card with NO subject.
  await page.goto('/memory-cards/new')
  const prompt = `Unfiled Q ${Date.now()}`
  await page.getByLabel('Question').fill(prompt)
  await page.getByTestId('card-form-submit').click()
  await expect(page).toHaveURL(/\/memory-cards(\?|$)/, { timeout: 15_000 })

  // Link it. The subject filter pre-fills "None" (card is unfiled) and lists no notes, so pick the
  // subject to reveal the note, choose it, and Link. Picking a subject the card didn't have proves
  // the card re-files to the note's subject, not the dialog filter.
  await page.getByTestId('card-link-note').first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Subject' }).click()
  await page.getByRole('option', { name: subjectTitle, exact: true }).click()
  // The Note combobox only mounts once the async note fetch resolves (spinner → combobox), so the
  // click auto-waits for it. Then filter by typing and — rather than racing Enter against cmdk's
  // filter (it intermittently selects nothing, leaving Link disabled) — wait for the filtered
  // option to render and click it.
  await dialog.getByRole('combobox', { name: 'Note' }).click()
  await page.getByPlaceholder('Search notes…').fill(noteTitle)
  await page.getByRole('option', { name: noteTitle, exact: true }).click()
  await page.getByTestId('link-card-confirm').click()

  // The card adopted the note: note_id points at that note and subject_id is the note's subject
  // (derived server-side, NOT left null and NOT the card's prior unfiled state).
  const db = await clientFor(email)
  const subject = await db.from('subjects').select('id').eq('title', subjectTitle).single()
  const note = await db.from('notes').select('id').eq('title', noteTitle).single()
  await expect
    .poll(async () => (await db.from('memory_cards').select('note_id, subject_id')).data?.[0])
    .toEqual({ note_id: note.data?.id, subject_id: subject.data?.id })
})
