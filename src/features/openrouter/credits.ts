import 'server-only'

import { getOpenRouterCredential } from '@/features/openrouter/credential'

const CREDITS_URL = 'https://openrouter.ai/api/v1/credits'

// OpenRouter meters spend in USD credits, not tokens — `remaining` is the wallet balance to show.
type OpenRouterCreditsT = {
  remaining: number
  total: number
  used: number
}

// Reads the caller's OpenRouter wallet via /credits with their decrypted key. Returns null when not
// connected OR the live call fails — the nav renders null as "nothing to show", so a slow/flaky
// OpenRouter can never block or break page render.
//
// Two failure paths, deliberately split: a decrypt throw is a SETUP bug (missing enc key / corrupted
// credential) that would otherwise masquerade as "not connected" — logged in dev so it's visible. A
// fetch failure is a TRANSIENT, expected blip — silent, no log noise. Both fail soft to null.
export async function getOpenRouterCredits(): Promise<OpenRouterCreditsT | null> {
  let credential
  try {
    credential = await getOpenRouterCredential()
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[openrouter] failed to decrypt credential for credits lookup', error)
    }
    return null
  }
  if (!credential) return null

  try {
    const res = await fetch(CREDITS_URL, {
      headers: { Authorization: `Bearer ${credential.apiKey}` },
      cache: 'no-store', // wallet balance is live state — never serve a stale number
      signal: AbortSignal.timeout(4000), // bound the Suspense stream; OpenRouter hiccup ≠ hung nav
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: { total_credits?: number; total_usage?: number }
    }
    const { total_credits: total, total_usage: used } = json.data ?? {}
    if (typeof total !== 'number' || typeof used !== 'number') return null
    return { remaining: total - used, total, used }
  } catch {
    return null
  }
}
