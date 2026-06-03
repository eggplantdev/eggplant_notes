import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { test, expect, type Page } from '@playwright/test'

// The PRD's #1 guardrail as an executable test: no user can read another user's rows.
// Sign-up goes through the real UI (exercising F-01's auth + cookie + proxy path); the
// data ops run through a per-account supabase-js client authenticated with
// signInWithPassword — NOT browser-cookie reuse (@supabase/ssr stores HttpOnly chunked
// cookies with no JS-accessible token). URL + anon key come from .env.local, loaded by
// playwright.config.ts into process.env — a raw spec process loads no env on its own.
const PASSWORD = 'password123'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Unique per-run email so reruns don't collide on the shared local auth.users table.
function uniqueEmail(tag: string) {
  return `e2e-iso-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

async function signUp(page: Page, email: string) {
  await page.goto('/sign-up')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/dashboard')
}

// Build an API client authenticated as the given account. signInWithPassword returns the
// access_token directly, so the client carries a real session and RLS applies as that user.
async function clientFor(email: string): Promise<SupabaseClient> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY — is .env.local loaded?')
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD })
  expect(error, `sign-in failed for ${email}`).toBeNull()
  return supabase
}

test('account B cannot read account A rows, and vice versa', async ({ browser }) => {
  const emailA = uniqueEmail('a')
  const emailB = uniqueEmail('b')
  const titleA = `note-A-${Date.now()}`
  const titleB = `note-B-${Date.now()}`

  // Sign up both accounts through the real UI in isolated browser contexts.
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  await signUp(await ctxA.newPage(), emailA)
  await signUp(await ctxB.newPage(), emailB)
  await ctxA.close()
  await ctxB.close()

  const supaA = await clientFor(emailA)
  const supaB = await clientFor(emailB)

  // Each account inserts its own note. user_id defaults to auth.uid() (NOT NULL + RLS
  // `with check`), so neither client can forge ownership.
  const insA = await supaA.from('notes').insert({ title: titleA }).select('id')
  const insB = await supaB.from('notes').insert({ title: titleB }).select('id')
  expect(insA.error, 'A insert failed').toBeNull()
  expect(insB.error, 'B insert failed').toBeNull()

  // A sees only its own note; B's row is invisible.
  const seenByA = await supaA.from('notes').select('title')
  expect(seenByA.error).toBeNull()
  const titlesA = (seenByA.data ?? []).map((r) => r.title)
  expect(titlesA).toContain(titleA)
  expect(titlesA).not.toContain(titleB)

  // B sees only its own note; A's row is invisible.
  const seenByB = await supaB.from('notes').select('title')
  expect(seenByB.error).toBeNull()
  const titlesB = (seenByB.data ?? []).map((r) => r.title)
  expect(titlesB).toContain(titleB)
  expect(titlesB).not.toContain(titleA)
})
