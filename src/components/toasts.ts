import { Bounce, toast } from 'react-toastify'

// Thin project wrapper over react-toastify so call sites use one API (not raw `toast.*`).
// Mirrors the `wykonczymy` reference verbatim (dark theme, Bounce, bottom-center, 2s, no
// progress bar) — keep its options; don't strip them (see lessons.md). The toastify CSS and
// the <ToastContainer> live in `toast-provider.tsx` (the client boundary), not here, so this
// module stays a plain, importable-anywhere helper.
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
    theme: 'dark',
    transition: Bounce,
  })
}
