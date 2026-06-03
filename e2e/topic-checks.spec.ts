import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { test, expect, type Page } from '@playwright/test'

// S-02 acceptance path: on a note, add a topic check (question + example + highlighted code
// context) → see it listed → edit → delete (FR-012–015). Plus a two-account isolation check on
// the new write/read path. Auth + the markdown body insert follow the same patterns as
// notes.spec.ts / isolation.spec.ts (sign-up via UI; execCommand insertText so CodeMirror's
// closeBrackets doesn't corrupt the ``` fence; supabase-js clients via signInWithPassword).
const PASSWORD = 'password123'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function uniqueEmail(tag: string) {
  return `e2e-tc-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

async function signUp(page: Page, email: string) {
  await page.goto('/sign-up')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/dashboard')
}

// Insert text into the (single) CodeMirror contenteditable — the code_context editor — without
// firing key handlers that would auto-close the fence.
async function fillEditor(page: Page, value: string) {
  const editor = page.locator('.cm-content')
  await editor.click()
  await editor.evaluate((_el, text) => document.execCommand('insertText', false, text), value)
}

async function clientFor(email: string): Promise<SupabaseClient> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY — is .env.local loaded?')
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD })
  expect(error, `sign-in failed for ${email}`).toBeNull()
  return supabase
}

const CODE_CONTEXT = ['```ts', 'const sum = (a: number, b: number) => a + b', '```'].join('\n')

test('full CRUD: add a topic check with highlighted code, list, edit, delete', async ({ page }) => {
  await signUp(page, uniqueEmail('crud'))

  // A note to attach checks to (title only — keeps the only code block on the page the check's).
  await page.goto('/notes/new')
  await page.getByLabel('Title').fill(`TC host note ${Date.now()}`)
  await page.getByRole('button', { name: 'Create note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/, { timeout: 15_000 })

  // Empty state, then add a check.
  await expect(page.getByText('No topic checks yet.')).toBeVisible()
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

// RLS on the new write/read path: account B cannot see account A's topic checks even when
// querying by A's note_id directly — the same `.eq('note_id', …)` shape getTopicChecksForNote
// uses (the helper itself can't be imported into a raw spec: its @/ alias + server-only
// next/headers deps don't resolve outside the Next runtime — see lessons.md). The new
// example/code_context columns round-trip for the owner.
test('topic checks are isolated by account on the per-note read path', async ({ browser }) => {
  const emailA = uniqueEmail('iso-a')
  const emailB = uniqueEmail('iso-b')

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
