// Post-redirect success messages keyed by URL-safe token: a redirecting Server Action can't toast
// directly (an in-closure toast is unreachable past redirect()), so it appends `?toast=<key>` and
// <ActionToast> toasts the mapped message after navigation. Client-importable, so the server-only
// writer (toastRedirect) lives separately to keep its next/navigation import out of here.
export const TOAST_MESSAGES = {
  'note-saved': 'Note saved',
  'note-deleted': 'Note deleted',
  'card-created': 'Card created',
  'card-saved': 'Card saved',
  'subject-saved': 'Subject saved',
  'subject-deleted': 'Subject deleted',
  'signed-in': 'Welcome back',
  'signed-up': 'Account created',
  'password-updated': 'Password updated',
  'account-deleted': 'Account deleted',
} as const

export type ToastKey = keyof typeof TOAST_MESSAGES
