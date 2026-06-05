import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, type Page } from '@playwright/test'

// Shared E2E harness. Every spec drives sign-up through the real UI (exercising the F-01
// auth + cookie + proxy path) and, when it needs an authenticated API client, builds one via
// signInWithPassword rather than reusing browser cookies (see lessons.md). Not a spec file
// (no test() calls), so Playwright's *.spec.ts testMatch never collects it.
export const PASSWORD = 'password123'

// URL + anon key come from .env.local, which playwright.config.ts loads into process.env — a
// raw worker process otherwise loads no env (see lessons.md).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Unique per-run email so reruns don't collide on the shared local auth.users table. `tag`
// namespaces the address per spec/account (e.g. 'notes', 'iso-a') for log readability.
export function uniqueEmail(tag = '') {
  const prefix = tag ? `${tag}-` : ''
  return `e2e-${prefix}${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

// Sign up through the real UI and land on the dashboard.
export async function signUp(page: Page, email: string) {
  await page.goto('/sign-up')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/dashboard')
}

// Create a note via the UI (title only) and land on its detail page (/notes/<id>). Shared by
// the specs that need a note to hang memory cards off (notes/memory-cards/review setup).
export async function createNote(page: Page, title: string) {
  await page.goto('/notes/new')
  await page.getByLabel('Title').fill(title)
  await page.getByRole('button', { name: 'Create note' }).click()
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/, { timeout: 15_000 })
}

// Attach a question-only memory card on the current note detail page and wait for it to list.
// The add form is deferred behind an "Add check" toggle (S-17), so reveal it first; it
// collapses again after a successful add, so each call re-reveals. (Specs exercising the
// optional example/code_context fields add their checks inline instead.)
export async function attachCheck(page: Page, prompt: string) {
  await page.getByRole('button', { name: 'Add check' }).click()
  await page.getByLabel('Question').fill(prompt)
  await page.getByRole('button', { name: 'Add memory card' }).click()
  await expect(page.locator('li', { hasText: prompt })).toBeVisible({ timeout: 15_000 })
}

// Insert text into the CodeMirror contenteditable without firing key handlers — closeBrackets
// would auto-close the ``` fence and the `{`, corrupting a pasted code block.
export async function fillEditor(page: Page, value: string) {
  const editor = page.locator('.cm-content')
  await editor.click()
  await editor.evaluate((_el, text) => document.execCommand('insertText', false, text), value)
}

// Build a supabase-js client authenticated as the given account. signInWithPassword returns the
// access_token directly, so the client carries a real session and RLS applies as that user.
export async function clientFor(email: string): Promise<SupabaseClient> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY — is .env.local loaded?')
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD })
  expect(error, `sign-in failed for ${email}`).toBeNull()
  return supabase
}
