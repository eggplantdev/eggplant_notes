import { test, expect, type Page } from '@playwright/test'

import { fillEditor, signUp, uniqueEmail } from './helpers'

// test-plan Phase 7 / risk R#7 regression tripwire. Proves untrusted markdown renders INERT
// through the single RenderMarkdown pipeline (render-markdown.tsx:9 → markdown-plugins.ts:
// remark-gfm + @shikijs/rehype, NO rehype-raw, NO urlTransform override) — no script runs, no
// element/handler injected, and dangerous javascript:/data:text/html links are neutralized.
//
// Convergence: all four untrusted body sources write through the same insertNoteWithChecks /
// import_notes core into the same RenderMarkdown pipeline — user editor, .md import
// (import-notes.ts → import_notes RPC), AI generation (generate-notes.ts), and the token HTTP
// API (src/app/api/notes/route.ts). We drive the two key-free UI paths here (editor + import);
// the AI path needs a live BYOK OpenRouter key and the token API has integration coverage, and
// both render through the identical pipeline — so they are covered-by-convergence, not re-tested.
// Memory-card fields render through the same pipeline too (same convergence).
//
// Why assert the observable DOM, not "no alert appeared": a test that only checks the absence of
// an alert passes even when the payload failed to fire for an unrelated reason — R#7's named
// anti-pattern. We assert no live <script>/<img>, that the handler globals stay falsy, that the
// raw markup survives as escaped text, and that the dangerous anchors carry no javascript:/data:
// href (react-markdown's defaultUrlTransform empties them).

// Four vectors in one body. None starts with `#`, so the import H1-split puts the whole payload
// in the note body (not the heading line).
const PAYLOAD = [
  '<script>window.__xssRan = true</script>',
  '<img src=x onerror="window.__xssImg = true">',
  '[click-js](javascript:window.__xssLink=true)',
  '[click-data](data:text/html,<script>window.__xssData=true</script>)',
].join('\n\n')

type XssFlagsT = {
  __xssRan?: boolean
  __xssImg?: boolean
  __xssLink?: boolean
  __xssData?: boolean
}

// Assert the rendered note body (`.prose`, from RenderMarkdown) is inert: no injected
// script/img, none of the handler globals set, raw markup escaped to text, dangerous hrefs empty.
async function expectInertRender(page: Page) {
  await expect(page.locator('.prose script')).toHaveCount(0)
  await expect(page.locator('.prose img')).toHaveCount(0)

  const flags = await page.evaluate(() => {
    const w = window as unknown as XssFlagsT
    return { ran: w.__xssRan, img: w.__xssImg, link: w.__xssLink, data: w.__xssData }
  })
  expect(flags.ran).toBeFalsy()
  expect(flags.img).toBeFalsy()
  expect(flags.link).toBeFalsy()
  expect(flags.data).toBeFalsy()

  // The raw <script> markup survives as visible, escaped text rather than executing.
  await expect(page.getByText('window.__xssRan = true')).toBeVisible()

  // The load-bearing new coverage: dangerous-protocol links are neutralized — defaultUrlTransform
  // returns '' for any protocol outside http(s)|ircs|mailto|xmpp, so the anchor href is empty.
  for (const linkText of ['click-js', 'click-data']) {
    const href = await page
      .locator('.prose')
      .getByRole('link', { name: linkText })
      .getAttribute('href')
    expect(href ?? '', `${linkText} href must be neutralized`).not.toMatch(/^(javascript|data):/i)
  }
}

test('user-editor note body renders untrusted markdown inert (no XSS)', async ({ page }) => {
  await signUp(page, uniqueEmail('xss-user'))
  await page.goto('/notes/new')
  await page.getByLabel('Title').fill(`XSS user ${Date.now()}`)
  await fillEditor(page, PAYLOAD)
  await page.getByRole('button', { name: 'Create note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/, { timeout: 15_000 })

  await expectInertRender(page)
})

test('imported .md note body renders untrusted markdown inert (no XSS)', async ({ page }) => {
  await signUp(page, uniqueEmail('xss-import'))
  const stamp = Date.now()
  const title = `XSS import ${stamp}`
  const subject = `XSS subject ${stamp}`

  await page.goto('/import')
  // Benign `#` title line; the payload lives in the body so the H1 split doesn't carve it up.
  await page.getByTestId('import-file').setInputFiles({
    name: 'xss.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(`# ${title}\n\n${PAYLOAD}`),
  })
  await page.getByTestId('import-level-h1').click()
  await page.getByTestId('import-subject-new-mode').click()
  await page.getByTestId('import-subject-title').fill(subject)
  await page.getByTestId('import-commit').click()

  // Commit redirects to the new subject, which only LISTS notes — navigate into the note to
  // render its body (per import-notes.spec.ts:50). An imported note opens at the subject-nested
  // read route /subjects/<sid>/<nid> (S-15), not /notes/<id>.
  await expect(page).toHaveURL(/\/subjects\/[0-9a-f-]+/, { timeout: 15_000 })
  await page.getByText(title).click()
  await expect(page).toHaveURL(/\/subjects\/[0-9a-f-]+\/[0-9a-f-]+/, { timeout: 15_000 })

  await expectInertRender(page)
})
