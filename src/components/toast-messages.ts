// Post-redirect success messages, keyed by a short URL-safe token. A redirecting Server Action
// appends `?toast=<key>` to its destination; <ActionToast> reads it after navigation and toasts
// the mapped message (an in-closure `toast.success` is unreachable past `redirect()`). Closed
// `as const` map → URLs carry a key, not raw copy, and the wording stays centralized here.
//
// Split out of `toasts.ts` (the react-toastify wrapper): this copy registry changes when product
// copy / redirect keys change, which is unrelated to the toastify transition/theme config — two
// reasons to change, so two files.
export const TOAST_MESSAGES = {
  'note-saved': 'Note saved',
  'note-deleted': 'Note deleted',
  'subject-saved': 'Subject saved',
  'subject-deleted': 'Subject deleted',
  'signed-in': 'Welcome back',
  'signed-up': 'Account created',
  'password-updated': 'Password updated',
  'account-deleted': 'Account deleted',
} as const

export type ToastKey = keyof typeof TOAST_MESSAGES
