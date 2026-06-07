'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { challengeFor, generateVerifier, VERIFIER_COOKIE } from '@/features/openrouter/pkce'
import { SITE_URL } from '@/lib/env'

// Build the callback origin from the request that initiated connect, so the flow works on any origin
// (a preview URL, the e2e port) — not just whatever NEXT_PUBLIC_SITE_URL is pinned to. Same reasoning
// as the email-template {{ .RedirectTo }} port-match lesson. Falls back to SITE_URL.
async function callbackOrigin(): Promise<string> {
  const host = (await headers()).get('host')
  if (!host) return SITE_URL
  const proto = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https'
  return `${proto}://${host}`
}

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
  url.searchParams.set('callback_url', `${await callbackOrigin()}/api/openrouter/callback`)
  url.searchParams.set('code_challenge', challengeFor(verifier))
  url.searchParams.set('code_challenge_method', 'S256')
  redirect(url.toString())
}
