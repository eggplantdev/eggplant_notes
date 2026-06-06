'use client'

import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

// Client boundary so the root server layout can mount toasts without becoming a client component.
// zIndex sits above shadcn overlays (dialogs/popovers) so error toasts are never occluded.
export function ToastProvider() {
  return <ToastContainer style={{ zIndex: 10001 }} />
}
