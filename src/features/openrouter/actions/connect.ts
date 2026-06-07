'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { challengeFor, generateVerifier, VERIFIER_COOKIE } from '@/features/openrouter/pkce'
import { SITE_URL } from '@/lib/env'

// Starts the OpenRouter OAuth PKCE connect: mint a verifier, stash it HttpOnly (unreadable to JS, so
// it can't be exfiltrated), and redirect to OpenRouter's auth page with the S256 challenge. The
// callback route replays the verifier to exchange the returned code for the user's key.
export async function connectOpenRouter() {
  const verifier = generateVerifier()
  const cookieStore = await cookies()
  cookieStore.set(VERIFIER_COOKIE, verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 min — the verifier is single-use and short-lived.
  })

  const url = new URL('https://openrouter.ai/auth')
  url.searchParams.set('callback_url', `${SITE_URL}/api/openrouter/callback`)
  url.searchParams.set('code_challenge', challengeFor(verifier))
  url.searchParams.set('code_challenge_method', 'S256')
  redirect(url.toString())
}
