import { test, expect, type Page } from '@playwright/test'

import { PASSWORD, signUp, uniqueEmail } from './helpers'

// Mailpit is the local SMTP catcher exposed by `supabase start` (see `supabase status`).
const MAILPIT = 'http://127.0.0.1:54324'
const NEW_PASSWORD = 'newpassword456'

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

// Poll Mailpit for the newest recovery email to `email` and return its confirm link.
async function getResetLink(page: Page, email: string): Promise<string> {
  const query = encodeURIComponent(`to:${email}`)
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await page.request.get(`${MAILPIT}/api/v1/search?query=${query}`)
    const { messages } = await search.json()
    if (messages?.length) {
      const detail = await page.request.get(`${MAILPIT}/api/v1/message/${messages[0].ID}`)
      const { HTML } = await detail.json()
      const href = HTML.match(/href="([^"]*\/api\/auth\/confirm[^"]*)"/)?.[1]
      if (href) return href.replace(/&amp;/g, '&')
    }
    await page.waitForTimeout(500)
  }
  throw new Error(`No reset email with a confirm link arrived in Mailpit for ${email}`)
}

test('3.5 sign-up creates a session and lands on the dashboard', async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible()
})

test('3.6 sign-out returns to sign-in, then sign-in lands on the dashboard', async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await expect(page).toHaveURL('/dashboard')

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/sign-in')

  await signIn(page, email)
  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible()
})

test('3.8 inline validation error renders for a too-short password', async ({ page }) => {
  await page.goto('/sign-up')
  await page.getByLabel('Email').fill(uniqueEmail())
  await page.getByLabel('Password').fill('123') // below minimum_password_length (6)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText(/at least 6/i)).toBeVisible()
  await expect(page).toHaveURL('/sign-up') // no navigation on invalid submit
})

test('4.4 unauthenticated /dashboard redirects to /sign-in', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/sign-in')
})

test('4.5 authenticated user hitting /sign-in is redirected to /dashboard', async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await expect(page).toHaveURL('/dashboard')

  await page.goto('/sign-in')
  await expect(page).toHaveURL('/dashboard')
})

test('3.7 password reset round trip via Mailpit', async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/sign-in')

  await page.goto('/reset-password')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Send reset link' }).click()

  const link = await getResetLink(page, email)
  await page.goto(link)
  await expect(page).toHaveURL('/update-password')

  await page.getByLabel('New password').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page).toHaveURL('/dashboard')

  // The new password works on a fresh sign-in.
  await page.getByRole('button', { name: 'Sign out' }).click()
  await signIn(page, email, NEW_PASSWORD)
  await expect(page).toHaveURL('/dashboard')
})
