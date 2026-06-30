import { test, expect } from '@playwright/test'

import { clientFor, createNote, fillEditor, signUp, uniqueEmail } from './helpers'

// S-02 acceptance path: on a note, add a memory card (question + a single markdown `example` field
// holding a fenced code block) → see it listed with highlighted code → edit → delete (FR-012–015).
// Plus a two-account isolation check on the write/read path. Shared auth/editor/client helpers live
// in ./helpers. The example field starts as a textarea and upgrades to the markdown editor on
// "Add formatting" (merge-card-example-and-code-context).
const CODE_EXAMPLE = ['```ts', 'const sum = (a: number, b: number) => a + b', '```'].join('\n')

test('full CRUD: add a memory card with highlighted code, list, edit, delete', async ({ page }) => {
  await signUp(page, uniqueEmail('tc-crud'))

  // A note to attach checks to (title only — keeps the only code block on the page the check's).
  await createNote(page, `TC host note ${Date.now()}`)

  // Empty state, then reveal the deferred add form (S-17: collapsed behind "Add card") and add.
  await expect(page.getByText('No memory cards yet.')).toBeVisible()
  await expect(page.getByLabel('Question')).toBeHidden()
  await page.getByRole('button', { name: 'Add card' }).click()
  const prompt = `What does sum do? ${Date.now()}`
  await page.getByLabel('Question').fill(prompt)
  // Upgrade the example field to the markdown editor, then enter a fenced code block.
  await page.getByTestId('card-example-rich').click()
  await fillEditor(page, CODE_EXAMPLE)
  await page.getByRole('button', { name: 'Add memory card' }).click()

  // It lists (AnimatedCardList renders shadcn Cards, not <li> rows), and its example's fenced code
  // renders Shiki-highlighted (per-token CSS vars), not flat text.
  const row = page.locator('[data-slot="card"]', { hasText: prompt })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('pre.shiki')).toBeVisible()
  expect(await page.locator('pre.shiki span[style*="--shiki"]').count()).toBeGreaterThan(3)

  // Edit via the dedicated /memory-cards/<id>/edit route → form seeds → change the question → save.
  await row.getByRole('button', { name: 'Edit' }).click()
  await expect(page).toHaveURL(/\/memory-cards\/[0-9a-f-]+\/edit$/)
  const editedPrompt = `${prompt} (edited)`
  await page.getByLabel('Question').fill(editedPrompt)
  await page.getByRole('button', { name: 'Save changes' }).click()

  // Saving redirects to the /memory-cards listing. Locate the list card by its prompt + Review
  // button — the due card also shows in the in-place review panel (also a [data-slot=card] but with
  // NO Review button), so this filter disambiguates the listing row from the panel. Reused for the
  // visibility assertion and the delete below.
  const editedRow = page
    .locator('[data-slot="card"]')
    .filter({ hasText: editedPrompt })
    .filter({ has: page.getByRole('button', { name: 'Review' }) })
  await expect(editedRow).toBeVisible({ timeout: 15_000 })
  await editedRow.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText(editedPrompt)).toHaveCount(0, { timeout: 15_000 })
})

// S-17 + merge-card-example-and-code-context: the CodeMirror island is now DOUBLY deferred — behind
// the "Add card" toggle AND the example field's "Add formatting" upgrade (the field starts as a
// plain textarea). `.cm-content` count is the observable proxy for the editor being mounted (the
// CodeMirror chunk loads on mount via next/dynamic) — 0 on read, 0 with the form open but the field
// still a textarea, 1 only after "Add formatting".
test('add-check form is deferred: no editor on read, reveals, upgrades, hides, collapses after add', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('tc-defer'))
  await createNote(page, `Defer host note ${Date.now()}`)

  // Read view: no editor mounted, form collapsed behind the toggle.
  await expect(page.locator('.cm-content')).toHaveCount(0)
  await expect(page.getByLabel('Question')).toBeHidden()
  const addCheck = page.getByRole('button', { name: 'Add card' })
  await expect(addCheck).toBeVisible()

  // Reveal the form → its example field is a textarea, so STILL no CodeMirror island.
  await addCheck.click()
  await expect(page.getByLabel('Question')).toBeVisible()
  await expect(page.locator('.cm-content')).toHaveCount(0)

  // Upgrade the example field → exactly one CodeMirror island mounts.
  await page.getByTestId('card-example-rich').click()
  await expect(page.locator('.cm-content')).toHaveCount(1)

  // Hide → form collapses, editor unmounts.
  await page.getByRole('button', { name: 'Hide' }).click()
  await expect(page.getByLabel('Question')).toBeHidden()
  await expect(page.locator('.cm-content')).toHaveCount(0)

  // Re-open, add a check (textarea-only, no upgrade) → it lists and the form collapses again.
  await addCheck.click()
  const prompt = `Deferred add ${Date.now()}`
  await page.getByLabel('Question').fill(prompt)
  await page.getByRole('button', { name: 'Add memory card' }).click()
  await expect(page.getByText(prompt)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByLabel('Question')).toBeHidden()
  await expect(page.locator('.cm-content')).toHaveCount(0)
})

// RLS on the new write/read path: account B cannot see account A's memory cards even when
// querying by A's note_id directly — the same `.eq('note_id', …)` shape getMemoryCardsForNote
// uses (the helper itself can't be imported into a raw spec: its @/ alias + server-only
// next/headers deps don't resolve outside the Next runtime — see lessons.md). The single
// markdown `example` column round-trips for the owner.
test('memory cards are isolated by account on the per-note read path', async ({ browser }) => {
  const emailA = uniqueEmail('tc-iso-a')
  const emailB = uniqueEmail('tc-iso-b')

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  await signUp(await ctxA.newPage(), emailA)
  await signUp(await ctxB.newPage(), emailB)
  await ctxA.close()
  await ctxB.close()

  const supaA = await clientFor(emailA)
  const supaB = await clientFor(emailB)

  // Account A seeds a note + a memory card carrying the new optional columns.
  const note = await supaA
    .from('notes')
    .insert({ title: `iso note ${Date.now()}` })
    .select('id')
    .single()
  expect(note.error, 'A note insert failed').toBeNull()
  const aNoteId = note.data!.id

  const tc = await supaA
    .from('memory_cards')
    .insert({
      note_id: aNoteId,
      prompt: 'A prompt',
      example: 'A example\n\n```ts\nconst x = 1\n```',
    })
    .select('id, example')
    .single()
  expect(tc.error, 'A memory_card insert failed').toBeNull()

  // Owner sees its check (with the new columns populated) on the per-note read shape.
  const ownRead = await supaA.from('memory_cards').select('*').eq('note_id', aNoteId)
  expect(ownRead.error).toBeNull()
  expect(ownRead.data?.length, 'A should see its own check').toBe(1)
  expect(ownRead.data?.[0].example).toContain('A example')
  expect(ownRead.data?.[0].example).toContain('const')

  // Negative control assurance: querying by A's note_id as B returns nothing — RLS, not a typo.
  const foreignRead = await supaB.from('memory_cards').select('*').eq('note_id', aNoteId)
  expect(foreignRead.error, 'B select should not error (just empty)').toBeNull()
  expect(foreignRead.data?.length, 'LEAK: B sees A memory cards').toBe(0)
})
