import { Bounce, toast } from 'react-toastify'

import type { ActionResultT } from '@/types/action'

// Options mirror the wykonczymy reference verbatim — keep them, don't strip them (see lessons.md).
// CSS + <ToastContainer> live in toast-provider.tsx, so this stays a plain importable-anywhere helper.
export type ToastType = 'success' | 'error' | 'warning' | 'info'

export type ToastPosition = 'bottom-center' | 'top-center'

export function toastMessage(
  message: string,
  type: ToastType = 'success',
  autoClose: number = 2000,
  position: ToastPosition = 'bottom-center',
) {
  toast[type](message, {
    position: position,
    hideProgressBar: true,
    autoClose: autoClose,
    closeOnClick: true,
    pauseOnHover: false,
    draggable: true,
    progress: undefined,
    pauseOnFocusLoss: false,
    theme: 'dark',
    transition: Bounce,
  })
}

// The single place a result becomes a toast, so the imperative and form seams can't drift on the branching.
export function toastResult(result: ActionResultT, successMessage?: string): void {
  if (!result.success) toastMessage(result.error, 'error')
  else if (successMessage) toastMessage(`${successMessage} ✌️`, 'success')
}
