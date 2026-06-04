import { redirect } from 'next/navigation'

import type { ToastKey } from '@/components/toast-messages'

// Typed writer for the `?toast=<key>` convention — a mistyped key fails `pnpm typecheck`
// instead of silently toasting nothing (keys + copy live in `toast-messages.ts`, read back
// by <ActionToast>). Appends with `&` if `path` already has a query string.
export function toastRedirect(path: string, key: ToastKey): never {
  const separator = path.includes('?') ? '&' : '?'
  redirect(`${path}${separator}toast=${key}`)
}
