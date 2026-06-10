import { chromium } from '@playwright/test'

const BASE = 'http://localhost:3100'
const PASSWORD = 'password123'
const uniqueEmail = (t) => `e2e-${t}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`

// Inject instrumentation into the page: record escape keys, focus moves, pointerdowns, and the
// exact moment the dialog element leaves the DOM — so a failure shows WHAT closed the dialog.
async function instrument(page) {
  await page.evaluate(() => {
    window.__ev = []
    const log = (s) => window.__ev.push(`${Math.round(performance.now())} ${s}`)
    document.addEventListener('keydown', (e) => log(`keydown ${e.key}`), true)
    document.addEventListener(
      'focusin',
      (e) => log(`focusin ${e.target?.tagName}.${e.target?.getAttribute?.('data-slot') ?? ''}`),
      true,
    )
    document.addEventListener(
      'pointerdown',
      (e) => log(`pointerdown ${e.target?.tagName}.${e.target?.getAttribute?.('data-slot') ?? ''}`),
      true,
    )
    const obs = new MutationObserver((muts) => {
      for (const m of muts)
        for (const n of m.removedNodes)
          if (n.nodeType === 1 && (n.querySelector?.('[data-slot="dialog-content"]') || n.getAttribute?.('data-slot') === 'dialog-portal'))
            log('>>> DIALOG REMOVED FROM DOM')
    })
    obs.observe(document.body, { childList: true, subtree: true })
  })
}

async function dumpEvents(page) {
  return page.evaluate(() => window.__ev ?? [])
}

async function runOnce(page, i) {
  const email = uniqueEmail('mc-link')
  await page.goto(`${BASE}/sign-up`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL(/\/dashboard(\?|$)/, { timeout: 20000 })

  const subjectTitle = `Subj ${Date.now()}`
  await page.goto(`${BASE}/subjects/new`)
  await page.getByLabel('Title').fill(subjectTitle)
  await page.getByRole('button', { name: 'Create subject' }).click()
  await page.waitForURL(/\/subjects\/[0-9a-f-]+/, { timeout: 20000 })

  const noteTitle = `Note ${Date.now()}`
  await page.goto(`${BASE}/notes/new`)
  await page.getByLabel('Title').fill(noteTitle)
  await page.getByRole('radiogroup', { name: 'Subject mode' }).locator('..').getByRole('combobox').click()
  await page.getByRole('option', { name: subjectTitle, exact: true }).click()
  await page.getByRole('button', { name: 'Create note' }).click()
  await page.waitForURL(/\/notes\/[0-9a-f-]+$/, { timeout: 20000 })

  await page.goto(`${BASE}/memory-cards/new`)
  await page.getByLabel('Question').fill(`Unfiled Q ${Date.now()}`)
  await page.getByTestId('card-form-submit').click()
  await page.waitForURL(/\/memory-cards(\?|$)/, { timeout: 20000 })

  await page.getByTestId('card-link-note').first().click()
  await instrument(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Subject' }).click()
  let outcome = 'pass'
  let errMsg = ''
  const T = 15000
  try {
    await page.getByRole('option', { name: subjectTitle, exact: true }).click({ timeout: T })
    await dialog.getByRole('combobox', { name: 'Note' }).click({ timeout: T })
    await page.getByPlaceholder('Search notes…').fill(noteTitle)
    // Deterministic: wait for the filtered note option, then click it (don't race Enter against
    // cmdk's filter — Enter intermittently selects nothing, leaving Link disabled).
    const opt = page.getByRole('option', { name: noteTitle, exact: true })
    await opt.waitFor({ state: 'visible', timeout: T })
    await opt.click({ timeout: T })
    await page.getByTestId('link-card-confirm').click({ timeout: T })
  } catch (e) {
    outcome = 'FAIL'
    errMsg = e.message.split('\n').slice(0, 2).join(' | ')
  }
  if (outcome === 'FAIL') {
    const ev = await dumpEvents(page)
    console.log(`run ${i}: FAIL — ${errMsg}`)
    ev.forEach((l) => console.log('   ', l))
  } else {
    console.log(`run ${i}: PASS`)
  }
  return outcome
}

const browser = await chromium.launch({ channel: 'chrome' })
const results = []
for (let i = 1; i <= 12; i++) {
  const page = await browser.newPage()
  try {
    results.push(await runOnce(page, i))
  } catch (e) {
    console.log(`run ${i}: SETUP ERROR — ${e.message.split('\n')[0]}`)
    results.push('setup-error')
  }
  await page.close()
  await new Promise((r) => setTimeout(r, 1500)) // let GoTrue breathe between heavy signups
}
console.log('RESULTS:', results.join(', '))
await browser.close()
