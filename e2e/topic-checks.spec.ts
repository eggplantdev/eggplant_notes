import { test, expect } from '@playwright/test'

import { clientFor, createNote, fillEditor, signUp, uniqueEmail } from './helpers'

// S-02 acceptance path: on a note, add a topic check (question + example + highlighted code
// context) → see it listed → edit → delete (FR-012–015). Plus a two-account isolation check on
// the new write/read path. Shared auth/editor/client helpers live in ./helpers.
const CODE_CONTEXT = ['```ts', 'const sum = (a: number, b: number) => a + b', '```'].join('\n')

test('full CRUD: add a topic check with highlighted code, list, edit, delete', async ({ page }) => {
  await signUp(page, uniqueEmail('tc-crud'))

  // A note to attach checks to (title only — keeps the only code block on the page the check's).
  await createNote(page, `TC host note ${Date.now()}`)

  // Empty state, then reveal the deferred add form (S-17: collapsed behind "Add check") and add.
  await expect(page.getByText('No topic checks yet.')).toBeVisible()
  await expect(page.getByLabel('Question')).toBeHidden()
  await page.getByRole('button', { name: 'Add check' }).click()
  const prompt = `What does sum do? ${Date.now()}`
  await page.getByLabel('Question').fill(prompt)
  await page.getByLabel('Example (optional)').fill('sum(2, 3) === 5')
  await fillEditor(page, CODE_CONTEXT)
  await page.getByRole('button', { name: 'Add topic check' }).click()

  // It lists, and its code context renders Shiki-highlighted (per-token CSS vars), not flat text.
  const row = page.locator('li', { hasText: prompt })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('pre.shiki')).toBeVisible()
  expect(await page.locator('pre.shiki span[style*="--shiki"]').count()).toBeGreaterThan(3)

  // Edit via the ?edit link → form seeds → change the question → save.
  await row.getByRole('link', { name: 'Edit' }).click()
  await expect(page).toHaveURL(/\?edit=[0-9a-f-]+/)
  const editedPrompt = `${prompt} (edited)`
  await page.getByLabel('Question').fill(editedPrompt)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText(editedPrompt)).toBeVisible({ timeout: 15_000 })

  // Delete via the row's AlertDialog confirm.
  const editedRow = page.locator('li', { hasText: editedPrompt })
  await editedRow.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText(editedPrompt)).toHaveCount(0, { timeout: 15_000 })
})

// S-17: the add-check form (and its CodeMirror island) is deferred behind an "Add check" toggle,
// so a read view mounts no editor. Reveal on click, collapse on "Hide", collapse after a
// successful add. `.cm-content` count is the observable proxy for the editor being mounted (the
// CodeMirror chunk loads on mount via next/dynamic) — 0 on read, 1 while the form is open.
test('add-check form is deferred: no editor on read, reveals, hides, collapses after add', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('tc-defer'))
  await createNote(page, `Defer host note ${Date.now()}`)

  // Read view: no editor mounted, form collapsed behind the toggle.
  await expect(page.locator('.cm-content')).toHaveCount(0)
  await expect(page.getByLabel('Question')).toBeHidden()
  const addCheck = page.getByRole('button', { name: 'Add check' })
  await expect(addCheck).toBeVisible()

  // Reveal → form + exactly one CodeMirror island mounts.
  await addCheck.click()
  await expect(page.getByLabel('Question')).toBeVisible()
  await expect(page.locator('.cm-content')).toHaveCount(1)

  // Hide → form collapses, editor unmounts.
  await page.getByRole('button', { name: 'Hide' }).click()
  await expect(page.getByLabel('Question')).toBeHidden()
  await expect(page.locator('.cm-content')).toHaveCount(0)

  // Re-open, add a check → it lists and the form collapses again (editor unmounts).
  await addCheck.click()
  const prompt = `Deferred add ${Date.now()}`
  await page.getByLabel('Question').fill(prompt)
  await page.getByRole('button', { name: 'Add topic check' }).click()
  await expect(page.locator('li', { hasText: prompt })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByLabel('Question')).toBeHidden()
  await expect(page.locator('.cm-content')).toHaveCount(0)
})

// RLS on the new write/read path: account B cannot see account A's topic checks even when
// querying by A's note_id directly — the same `.eq('note_id', …)` shape getTopicChecksForNote
// uses (the helper itself can't be imported into a raw spec: its @/ alias + server-only
// next/headers deps don't resolve outside the Next runtime — see lessons.md). The new
// example/code_context columns round-trip for the owner.
test('topic checks are isolated by account on the per-note read path', async ({ browser }) => {
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

  // Account A seeds a note + a topic check carrying the new optional columns.
  const note = await supaA
    .from('notes')
    .insert({ title: `iso note ${Date.now()}` })
    .select('id')
    .single()
  expect(note.error, 'A note insert failed').toBeNull()
  const aNoteId = note.data!.id

  const tc = await supaA
    .from('topic_checks')
    .insert({
      note_id: aNoteId,
      prompt: 'A prompt',
      example: 'A example',
      code_context: '```ts\nconst x = 1\n```',
    })
    .select('id, example, code_context')
    .single()
  expect(tc.error, 'A topic_check insert failed').toBeNull()

  // Owner sees its check (with the new columns populated) on the per-note read shape.
  const ownRead = await supaA.from('topic_checks').select('*').eq('note_id', aNoteId)
  expect(ownRead.error).toBeNull()
  expect(ownRead.data?.length, 'A should see its own check').toBe(1)
  expect(ownRead.data?.[0].example).toBe('A example')
  expect(ownRead.data?.[0].code_context).toContain('const')

  // Negative control assurance: querying by A's note_id as B returns nothing — RLS, not a typo.
  const foreignRead = await supaB.from('topic_checks').select('*').eq('note_id', aNoteId)
  expect(foreignRead.error, 'B select should not error (just empty)').toBeNull()
  expect(foreignRead.data?.length, 'LEAK: B sees A topic checks').toBe(0)
})
