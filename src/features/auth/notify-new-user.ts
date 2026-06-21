import 'server-only'

import { EMAIL_USER } from '@/lib/env'
import { serverEnv } from '@/lib/env.server'
import { mailTransport } from '@/lib/mailer'

// Operator notification for a new sign-up. Never throws — a failed notification must never affect
// the user's sign-up. Call inside next/server `after()` so it runs post-response (non-blocking) and
// survives the redirect under Fluid Compute (waitUntil-backed on Vercel).
export async function notifyNewUser(email: string): Promise<void> {
  try {
    await mailTransport.sendMail({
      from: EMAIL_USER,
      to: serverEnv.EMAIL_TO,
      subject: 'Eggplant_notes: new sign-up',
      text: `New user signed up: ${email}`,
    })
  } catch (err) {
    console.error('New-user notification failed:', err instanceof Error ? err.message : err)
  }
}
