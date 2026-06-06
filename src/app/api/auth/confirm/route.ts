import { type EmailOtpType } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'

// Allowlist so an unexpected `type` from the query string is rejected, not cast through blindly.
const ALLOWED_OTP_TYPES = ['recovery', 'email'] as const

// Exchanges an email-link token for a session.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const rawType = searchParams.get('type')
  const type = (ALLOWED_OTP_TYPES as readonly string[]).includes(rawType ?? '')
    ? (rawType as EmailOtpType)
    : null

  if (token_hash && type) {
    const supabase = await createClient()
    let verified = false
    try {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash })
      verified = !error
    } catch {
      // A thrown failure (network etc.) falls through to the error redirect rather than 500-ing.
      // redirect() is kept OUT of this try — it signals via a thrown NEXT_REDIRECT we must not swallow.
    }

    if (verified) {
      redirect(type === 'recovery' ? '/update-password' : '/dashboard')
    }
  }

  redirect('/sign-in?error=Could not verify the link')
}
