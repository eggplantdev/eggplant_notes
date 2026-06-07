'use client'

import { Sparkles } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { connectOpenRouter } from '@/features/openrouter/actions/connect'

// Shown when an AI feature is used while OpenRouter is not connected. "Connect" submits the same
// connect Server Action used on /settings (redirects to OpenRouter's OAuth page); "Cancel" dismisses.
export function ConnectGateDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="ai-connect-gate">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Sparkles />
          </AlertDialogMedia>
          <AlertDialogTitle>Bring your own API key</AlertDialogTitle>
          <AlertDialogDescription>
            AI features run on your own OpenRouter account. Connect it once to generate notes and
            cards — your key is encrypted at rest and never shared.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
          <form action={connectOpenRouter}>
            <Button type="submit" variant="ai" size="sm" data-testid="ai-gate-connect">
              <Sparkles />
              Connect OpenRouter
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
