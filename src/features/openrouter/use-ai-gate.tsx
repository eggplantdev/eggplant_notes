'use client'

import { useState } from 'react'

import { ConnectGateDialog } from '@/features/openrouter/components/connect-gate-dialog'

// The single gate every AI feature uses. The trigger is always rendered (so the feature is
// discoverable even when not connected); `guard` wraps its action so it runs when connected and
// otherwise opens the BYOK dialog. Render `gateDialog` once alongside the gated trigger.
export function useAiGate(connected: boolean) {
  const [open, setOpen] = useState(false)

  function guard(run: () => void) {
    return () => (connected ? run() : setOpen(true))
  }

  const gateDialog = <ConnectGateDialog open={open} onOpenChange={setOpen} />

  return { guard, gateDialog }
}
