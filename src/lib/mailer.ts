import 'server-only'

import nodemailer from 'nodemailer'

import { EMAIL_USER } from '@/lib/env'
import { serverEnv } from '@/lib/env.server'

// Module-scope transport — reused across invocations under Fluid Compute. Port 465 + secure (SMTPS),
// mirroring the portfolio repo's working SMTP config. Shared by every sender (contact form,
// new-user notification); the SMTP config must live in exactly one place.
export const mailTransport = nodemailer.createTransport({
  host: serverEnv.EMAIL_HOST,
  port: 465,
  secure: true,
  auth: { user: EMAIL_USER, pass: serverEnv.EMAIL_PASS },
})
