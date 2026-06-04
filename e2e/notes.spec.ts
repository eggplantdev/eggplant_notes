import { test, expect } from '@playwright/test'

import { createNote, fillEditor, signUp, uniqueEmail } from './helpers'

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

// S-13 guard: render-markdown.tsx constrains Shiki to the curated SHIKI_LANGS with
// `lazy: true` + `fallbackLanguage: 'text'`. A fence in a language Shiki cannot resolve must
// degrade to plain text WITHOUT throwing — never blow up a render path. Under `text` fallback
// the `--shiki` CSS vars sit on the <pre> element only; the inner token <span>s carry none, so
// `pre.shiki span[style*="--shiki"]` is 0 (vs >3 for the highlighted block in the CRUD test
// above). A valid-but-off-list language would lazy-load and highlight — so this uses a BOGUS
// token to exercise the fallback path specifically. Own note → no cross-contamination.
test('unknown fence language falls back to plain text without error (S-13)', async ({ page }) => {
  await signUp(page, uniqueEmail('shiki-fallback'))
  const title = `Bogus fence ${Date.now()}`

  await page.goto('/notes/new')
  await page.getByLabel('Title').fill(title)
  await fillEditor(page, ['```xyzzy', 'const x = 1', '```'].join('\n'))
  await page.getByRole('button', { name: 'Create note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/, { timeout: 15_000 })

  // Rendered (no error page), wrapped as a Shiki <pre>, but with zero per-token highlighting —
  // the fallback fired instead of throwing on the unresolvable grammar.
  await expect(page.locator('pre.shiki')).toBeVisible()
  await expect(page.locator('pre.shiki span[style*="--shiki"]')).toHaveCount(0)
  await expect(page.getByText('const x = 1')).toBeVisible()
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

// S-14 in-place edit: the body+subject edit moved off the deleted /notes/[id]/edit route into
// a ?edit=note branch on the detail page. Locks three things the CRUD test above doesn't:
// (1) the F3 no-redirect property — `?edit=note` must NOT bounce (a regression forwarding
// editId='note' to TopicChecksSection would trip its stale-?edit guard and redirect to the bare
// path); (2) the body actually round-trips through the inline form; (3) the old route 404s.
test('in-place edit: ?edit=note shows the form without redirecting, edits the body, /edit 404s (S-14)', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('notes-edit'))
  await createNote(page, `Inline edit ${Date.now()}`)
  const noteUrl = page.url()

  // F3 lock: a direct hit on ?edit=note stays put (form in place), it does NOT redirect away,
  // and the topic-checks section still renders read-only below.
  await page.goto(`${noteUrl}?edit=note`)
  await expect(page).toHaveURL(/\?edit=note$/)
  await expect(page.getByLabel('Title')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Topic checks' })).toBeVisible()

  // Edit the body in place → save → redirected off the ?edit URL with the new content rendered.
  // Scope to the FIRST CodeMirror: edit mode shows two — NoteForm's body editor (first) and the
  // TopicChecksSection add-form's code_context editor below — so the shared fillEditor's bare
  // `.cm-content` locator would be ambiguous here.
  const marker = `inline-body-${Date.now()}`
  const bodyEditor = page.locator('.cm-content').first()
  await bodyEditor.click()
  await bodyEditor.evaluate((_el, text) => document.execCommand('insertText', false, text), marker)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+(\?|$)/, { timeout: 15_000 })
  await expect(page).not.toHaveURL(/\?edit=note/)
  await expect(page.getByText(marker)).toBeVisible({ timeout: 15_000 })

  // The dedicated edit route is gone.
  const resp = await page.goto(`${noteUrl}/edit`)
  expect(resp?.status()).toBe(404)
})
