import { test, expect } from '@playwright/test'

import { clientFor, signUp, uniqueEmail } from './helpers'

// Server-side search + numbered pagination on the list pages, plus the client-side sidebar title
// filter. Sign-up goes through the real UI (auth-path coverage); bulk data is seeded via the
// authenticated supabase-js client (per lessons.md — UI for auth, programmatic client for data).
// `user_id` is omitted on insert: the DB defaults it to auth.uid() and RLS guards it.

test('notes list: 24-cap + footer, body-only search narrows, page links preserve ?q', async ({
  page,
}) => {
  const email = uniqueEmail('list-search')
  await signUp(page, email)
  const supabase = await clientFor(email)

  const stamp = Date.now()
  const tag = `bulk${stamp}` // in EVERY title → a search for it returns the whole 26-row set
  const bodyToken = `bodyonly${stamp}` // ONLY in one note's content, never in any title

  const rows = Array.from({ length: 26 }, (_, i) => ({
    title: `${tag} note ${i + 1}`,
    content: i === 25 ? `this note mentions ${bodyToken} in its body only` : '',
  }))
  const { error } = await supabase.from('notes').insert(rows)
  expect(error, 'bulk note insert failed').toBeNull()

  // Page 1 caps at 24 of 26; the footer shows the range.
  await page.goto('/notes')
  await expect(page.getByText('26 notes')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Showing 1.24 of 26/)).toBeVisible()

  // Page 2 shows the tail.
  await page.goto('/notes?page=2')
  await expect(page.getByText(/Showing 25.26 of 26/)).toBeVisible({ timeout: 15_000 })

  // Body-only search: the token lives only in one note's content (not its title) → that note
  // returns, proving search hits `content`, and the result fits one page (footer hidden).
  await page.goto('/notes')
  await page.getByPlaceholder(/Search notes/).fill(bodyToken)
  await expect(page).toHaveURL(new RegExp(`[?&]q=${bodyToken}`), { timeout: 15_000 })
  await expect(page.getByText('1 note', { exact: true })).toBeVisible()
  await expect(page.getByText(/Showing \d+.\d+ of/)).toHaveCount(0)

  // Whole-set search keeps pagination; the page-2 link must preserve ?q.
  await page.getByPlaceholder(/Search notes/).fill(tag)
  await expect(page).toHaveURL(new RegExp(`[?&]q=${tag}`), { timeout: 15_000 })
  await expect(page.getByText(/Showing 1.24 of 26/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go to page 2' })).toHaveAttribute(
    'href',
    new RegExp(`q=${tag}`),
  )
})

test('subject note sidebar filters titles instantly, client-side, with no navigation', async ({
  page,
}) => {
  const email = uniqueEmail('sidebar-filter')
  await signUp(page, email)
  const supabase = await clientFor(email)

  const stamp = Date.now()
  const { data: subject, error: subjErr } = await supabase
    .from('subjects')
    .insert({ title: `Sidebar subject ${stamp}` })
    .select('id')
    .single()
  expect(subjErr, 'subject insert failed').toBeNull()
  const subjectId = subject!.id as string

  const apple = `Apple note ${stamp}`
  const banana = `Banana note ${stamp}`
  const cherry = `Cherry note ${stamp}`
  const { error: notesErr } = await supabase.from('notes').insert([
    { title: apple, subject_id: subjectId, position: 1 },
    { title: banana, subject_id: subjectId, position: 2 },
    { title: cherry, subject_id: subjectId, position: 3 },
  ])
  expect(notesErr, 'note insert failed').toBeNull()

  await page.goto(`/subjects/${subjectId}`)
  const sidebar = page.getByRole('navigation', { name: 'Notes in this subject' }).first()
  await expect(sidebar.getByRole('link', { name: apple })).toBeVisible({ timeout: 15_000 })
  await expect(sidebar.getByRole('link', { name: banana })).toBeVisible()
  await expect(sidebar.getByRole('link', { name: cherry })).toBeVisible()

  // Typing filters in-memory: only the matching title remains and the URL never changes.
  const urlBefore = page.url()
  await page
    .getByPlaceholder(/Filter notes/)
    .first()
    .fill('Banana')
  await expect(sidebar.getByRole('link', { name: banana })).toBeVisible()
  await expect(sidebar.getByRole('link', { name: apple })).toHaveCount(0)
  await expect(sidebar.getByRole('link', { name: cherry })).toHaveCount(0)
  expect(page.url()).toBe(urlBefore)

  // Clearing restores the full list (active-note highlight logic is unaffected — derived from the URL).
  await page
    .getByPlaceholder(/Filter notes/)
    .first()
    .fill('')
  await expect(sidebar.getByRole('link', { name: apple })).toBeVisible()
  await expect(sidebar.getByRole('link', { name: cherry })).toBeVisible()
})
