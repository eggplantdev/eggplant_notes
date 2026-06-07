---
change_id: contact-form
title: Authenticated-only contact form with footer trigger and nodemailer SMTP
status: new
created: 2026-06-07
updated: 2026-06-07
archived_at: null
---

## Notes

authenticated-only contact form: minimal site footer (© + Eggplant wordmark + "Contact me" button) opens a shadcn dialog; TanStack useAppForm with subject+message; server action reads the session user's email (not client-supplied), sends one email to EMAIL_TO via standalone nodemailer SMTP (port 465, replyTo=user), no auto-reply. New server-only env vars EMAIL_HOST/EMAIL_USER/EMAIL_PASS/EMAIL_TO in src/lib/env.ts. Feature lives in src/features/contact/; footer in src/components/layout/. Pattern ported from /workspace/portfolio/old_page/helpers/send-email.ts (standalone nodemailer, no Payload).
