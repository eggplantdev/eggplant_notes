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

type SeedT = {
  noteId: string
  topicCheckId: string
  reviewEventId: string
  title: string
  prompt: string
}

// Seed the full cascade chain (note → topic_check → review_event) for one account. Every
// row's user_id defaults to auth.uid() (NOT NULL + RLS `with check`), so no client can
// forge ownership. Returns the row ids so the other account can attempt to read them.
async function seedChain(supabase: SupabaseClient, tag: string): Promise<SeedT> {
  const title = `note-${tag}-${Date.now()}`
  const prompt = `prompt-${tag}-${Date.now()}`

  const note = await supabase.from('notes').insert({ title }).select('id').single()
  expect(note.error, `${tag} note insert failed`).toBeNull()
  const noteId = note.data!.id

  const tc = await supabase
    .from('topic_checks')
    .insert({ note_id: noteId, prompt })
    .select('id')
    .single()
  expect(tc.error, `${tag} topic_check insert failed`).toBeNull()
  const topicCheckId = tc.data!.id

  const re = await supabase
    .from('review_events')
    .insert({ topic_check_id: topicCheckId, rating: 5 })
    .select('id')
    .single()
  expect(re.error, `${tag} review_event insert failed`).toBeNull()
  const reviewEventId = re.data!.id

  return { noteId, topicCheckId, reviewEventId, title, prompt }
}

// Assert `client` sees its own row in `table` but NOT the other account's row.
async function assertIsolated(
  client: SupabaseClient,
  table: 'notes' | 'topic_checks' | 'review_events',
  ownId: string,
  foreignId: string,
) {
  const { data, error } = await client.from(table).select('id')
  expect(error, `select ${table} failed`).toBeNull()
  const ids = (data ?? []).map((r) => r.id as string)
  expect(ids, `expected own ${table} row visible`).toContain(ownId)
  expect(ids, `LEAK: foreign ${table} row visible`).not.toContain(foreignId)
}

test('accounts are isolated across notes, topic_checks, and review_events', async ({ browser }) => {
  const emailA = uniqueEmail('a')
  const emailB = uniqueEmail('b')

  // Sign up both accounts through the real UI in isolated browser contexts.
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  await signUp(await ctxA.newPage(), emailA)
  await signUp(await ctxB.newPage(), emailB)
  await ctxA.close()
  await ctxB.close()

  const supaA = await clientFor(emailA)
  const supaB = await clientFor(emailB)

  // Each account seeds its own full chain.
  const a = await seedChain(supaA, 'A')
  const b = await seedChain(supaB, 'B')

  // Every table's RLS scopes rows to the owner — each account sees only its own row and
  // never the other's, in both directions, at all three levels of the cascade.
  await assertIsolated(supaA, 'notes', a.noteId, b.noteId)
  await assertIsolated(supaB, 'notes', b.noteId, a.noteId)
  await assertIsolated(supaA, 'topic_checks', a.topicCheckId, b.topicCheckId)
  await assertIsolated(supaB, 'topic_checks', b.topicCheckId, a.topicCheckId)
  await assertIsolated(supaA, 'review_events', a.reviewEventId, b.reviewEventId)
  await assertIsolated(supaB, 'review_events', b.reviewEventId, a.reviewEventId)
})
