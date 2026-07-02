import { test, expect, type Page } from '@playwright/test'

import { clientFor, createNote, signUp, uniqueEmail } from './helpers'

// nav-cache-staletimes: staleTimes.dynamic=300 turns the client Router Cache ON, so repeat soft-nav
// between authed pages is served from in-browser memory (no server round-trip). The risk that creates:
// a cached page can show STALE data after a write — so every in-app mutation busts the cache via a
// Server Action's revalidatePath('/', 'layout'). These two specs pin both halves.
//
// They MUST navigate by clicking the nav links (soft client-side navigation), never page.goto(): a
// full document load bypasses AND clears the client Router Cache, so a goto-based test would pass even
// with the cache OFF (vacuous). Both assert on rendered note titles, not network introspection — robust
// to Next's link prefetch. Provenance: context/changes/nav-cache-staletimes/ (design.md + plan.md).

// Click a top-nav link = soft client-side navigation. Scoped to the desktop header (role=banner) so the
// hidden mobile nav's duplicate links can't trip strict mode (lessons.md: dual-nav ambiguity).
async function softNav(page: Page, name: string) {
  await page.getByRole('banner').getByRole('link', { name, exact: true }).click()
}

// Risk (cache is ON): a page we've already visited is served from the client cache on soft-nav back,
// so an OUT-OF-BAND change (direct DB write, no app revalidation) is NOT reflected within the window.
// Deliberate break — set staleTimes.dynamic=0 in next.config.ts: the back-nav refetches and shows the
// new title, failing this test. That inversion is what proves the assertion protects the cache.
test('client Router Cache serves a visited /notes from memory — out-of-band change not reflected', async ({
  page,
}) => {
  const email = uniqueEmail('nav-cache-read')
  await signUp(page, email)
  const v1 = `Cache V1 ${Date.now()}`
  await createNote(page, v1) // lands on /notes/<id>
  const noteId = page.url().split('/notes/')[1]

  // First visit caches /notes in the client Router Cache.
  await softNav(page, 'Notes')
  await expect(page).toHaveURL('/notes')
  await expect(page.getByText(v1)).toBeVisible()

  // Leave /notes, then rename the note OUT OF BAND — a direct DB write that never runs app code, so
  // nothing revalidates. The only way the UI could pick this up is by refetching /notes.
  await softNav(page, 'Subjects')
  await expect(page).toHaveURL('/subjects')
  const v2 = `Cache V2 ${Date.now()}`
  const db = await clientFor(email)
  const { error } = await db.from('notes').update({ title: v2 }).eq('id', noteId)
  expect(error, 'out-of-band update failed').toBeNull()
  // Stop the client's auth auto-refresh timer so the worker process can exit cleanly (otherwise
  // Playwright force-kills it after 300s → nonzero exit even though the tests passed).
  db.auth.stopAutoRefresh()

  // Soft-nav back to the already-visited /notes → served from the client cache → still V1, never V2.
  await softNav(page, 'Notes')
  await expect(page).toHaveURL('/notes')
  await expect(page.getByText(v1)).toBeVisible()
  await expect(page.getByText(v2)).toHaveCount(0)
})

// Risk (in-app write busts the cache): editing a note title through the UI (updateNote, a Server Action
// calling revalidatePath('/', 'layout')) MUST drop the cached /notes so the next soft-nav shows the new
// title — no stale list after a write. Deliberate break — remove revalidatePath from update-note.ts:
// the cached /notes serves the OLD title and this fails. This is the core correctness guarantee.
test('an in-app note-title edit busts the cached /notes — new title shows on soft-nav back', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('nav-cache-bust'))
  const original = `Bust before ${Date.now()}`
  await createNote(page, original)

  // Cache /notes with the original title.
  await softNav(page, 'Notes')
  await expect(page).toHaveURL('/notes')
  await expect(page.getByText(original)).toBeVisible()

  // Open the note and edit its title in place (Server Action → revalidatePath bust).
  await page.getByText(original).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/)
  await page.getByRole('link', { name: 'Edit' }).click()
  const edited = `Bust after ${Date.now()}`
  await page.getByLabel('Title').fill(edited)
  await page.getByRole('button', { name: 'Save changes' }).click()
  // Edit stays in place now (no redirect); the toast confirms the Server Action (revalidatePath) ran.
  await expect(page.getByText('Note saved')).toBeVisible({ timeout: 15_000 })

  // Soft-nav back to /notes → the cache was busted → new title shows, old is gone.
  await softNav(page, 'Notes')
  await expect(page).toHaveURL('/notes')
  await expect(page.getByText(edited)).toBeVisible()
  await expect(page.getByText(original)).toHaveCount(0)
})
