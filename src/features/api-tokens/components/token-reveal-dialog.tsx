'use client'

import { useState } from 'react'

import { toastMessage } from '@/components/toasts'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type TokenRevealDialogPropsT = {
  // Non-null opens the dialog; the parent clears it on close so the secret leaves client state.
  rawToken: string | null
  onClose: () => void
}

// Shows a freshly-minted token exactly once. There is no precedent for clipboard/reveal in the repo,
// so this is built from the shadcn primitives. The token is never re-fetchable — closing this dialog
// is the user's only chance to copy it, which the copy explains.
export function TokenRevealDialog({ rawToken, onClose }: TokenRevealDialogPropsT) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!rawToken) return
    // navigator.clipboard is undefined outside a secure context (plain-HTTP non-localhost). The token
    // stays visible in the read-only input either way, so a missing API degrades, never throws.
    if (!navigator.clipboard) {
      toastMessage('Copy unavailable here — select the token and copy it manually', 'warning')
      return
    }
    try {
      await navigator.clipboard.writeText(rawToken)
      setCopied(true)
      toastMessage('Copied', 'success')
    } catch {
      toastMessage('Could not copy — select the token and copy it manually', 'error')
    }
  }

  return (
    <Dialog
      open={rawToken !== null}
      onOpenChange={(next) => {
        if (!next) {
          setCopied(false)
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your new token</DialogTitle>
          <DialogDescription>
            Copy it now — it&apos;s shown only once and can&apos;t be retrieved again. If you lose
            it, revoke it and mint a new one.
          </DialogDescription>
        </DialogHeader>

        <Input
          readOnly
          value={rawToken ?? ''}
          className="font-mono"
          data-testid="token-reveal-value"
          onFocus={(e) => e.currentTarget.select()}
        />

        <DialogFooter showCloseButton>
          <Button type="button" onClick={copy} data-testid="token-reveal-copy">
            {copied ? 'Copied ✓' : 'Copy token'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
