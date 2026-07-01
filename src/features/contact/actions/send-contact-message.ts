'use server'

import { contactSchema, type ContactInputT } from '@/features/contact/schemas'
import { EMAIL_USER } from '@/lib/env'
import { serverEnv } from '@/lib/env.server'
import { mailTransport } from '@/lib/mailer'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Auth gate is the spam control (no captcha/rate-limit).
export async function sendContactMessage(input: ContactInputT): Promise<ActionResultT> {
  const user = await getCurrentUser()
  if (!user?.email) return { success: false, error: 'Not authenticated' }

  const parsed = validateInput(contactSchema, input)
  if (!parsed.success) return parsed

  try {
    await mailTransport.sendMail({
      from: EMAIL_USER,
      to: serverEnv.EMAIL_TO,
      replyTo: user.email,
      subject: `Eggplant_notes contact: ${parsed.data.subject}`,
      text: [
        `From: ${user.email}`,
        `Subject: ${parsed.data.subject}`,
        '',
        parsed.data.message,
      ].join('\n'),
    })
    return { success: true }
  } catch (err) {
    console.error('Contact send failed:', err instanceof Error ? err.message : err)
    return { success: false, error: 'Failed to send message' }
  }
}
