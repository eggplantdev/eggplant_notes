import { test, expect } from '@playwright/test'

import { fillEditor, signUp, uniqueEmail } from './helpers'

// S-01 acceptance path as an executable test: create → list → highlighted detail → edit →
// delete. Shared auth/editor helpers live in ./helpers; the markdown body is inserted with
// execCommand insertText (CodeMirror's closeBrackets would corrupt the ``` fence on keystrokes).
const CODE_BODY = [
  '# Heading',
  '',
  '```ts',
  'function fib(n: number): number {',
  '  return n < 2 ? n : fib(n - 1) + fib(n - 2)',
  '}',
  '```',
].join('\n')

test('full CRUD: create a note with code, see it highlighted, edit, delete', async ({ page }) => {
  await signUp(page, uniqueEmail('notes'))
  const title = `E2E note ${Date.now()}`

  // Create
  await page.goto('/notes/new')
  await page.getByLabel('Title').fill(title)
  await fillEditor(page, CODE_BODY)
  await page.getByRole('button', { name: 'Create note' }).click()
  // First server action on a freshly-started prod server can be slow to round-trip the
  // insert + redirect — give the navigation room beyond the 5s default.
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/, { timeout: 15_000 })

  // Detail renders the code block Shiki-highlighted (dual-theme → per-token CSS vars),
  // not a flat <pre> of text.
  await expect(page.locator('pre.shiki')).toBeVisible()
  const tokenCount = await page.locator('pre.shiki span[style*="--shiki"]').count()
  expect(tokenCount).toBeGreaterThan(3)

  // It appears in the list
  await page.goto('/notes')
  await expect(page.getByText(title)).toBeVisible()

  // Edit the title
  await page.getByText(title).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/)
  await page.getByRole('link', { name: 'Edit' }).click()
  const editedTitle = `${title} (edited)`
  await page.getByLabel('Title').fill(editedTitle)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('heading', { name: editedTitle })).toBeVisible({ timeout: 15_000 })

  // Delete via the AlertDialog confirm
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL('/notes', { timeout: 15_000 })
  await expect(page.getByText(editedTitle)).toHaveCount(0)
})

// Guards the load-bearing safety property of render-markdown.tsx: react-markdown runs
// WITHOUT rehype-raw, so raw HTML in a note body is escaped to inert text, never executed.
// If anyone adds rehype-raw for "richer notes" later, this turns red instead of silently
// shipping stored XSS.
test('note body raw HTML is rendered inert, not executed (no stored XSS)', async ({ page }) => {
  await signUp(page, uniqueEmail('notes'))
  await page.goto('/notes/new')
  await page.getByLabel('Title').fill(`XSS guard ${Date.now()}`)
  await fillEditor(
    page,
    '<script>window.__xssRan = true</script>\n\n<img src=x onerror="window.__xssImg = true">',
  )
  await page.getByRole('button', { name: 'Create note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/, { timeout: 15_000 })

  // No live <script>/<img> injected into the rendered body, and neither handler ran.
  await expect(page.locator('.prose script')).toHaveCount(0)
  await expect(page.locator('.prose img')).toHaveCount(0)
  expect(
    await page.evaluate(() => (window as unknown as { __xssRan?: boolean }).__xssRan),
  ).toBeFalsy()
  expect(
    await page.evaluate(() => (window as unknown as { __xssImg?: boolean }).__xssImg),
  ).toBeFalsy()
  // The markup survives as visible, escaped text.
  await expect(page.getByText('window.__xssRan = true')).toBeVisible()
})
