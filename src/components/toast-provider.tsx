'use client'

import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

// Client boundary for the toast layer: renders the single configured <ToastContainer> and
// imports the toastify CSS, so the root server layout can mount toasts without itself becoming
// a client component. Mounted once in `src/app/layout.tsx`. zIndex sits above shadcn overlays
// (dialogs/popovers) so error toasts are never occluded.
export function ToastProvider() {
  return <ToastContainer style={{ zIndex: 10001 }} />
}
