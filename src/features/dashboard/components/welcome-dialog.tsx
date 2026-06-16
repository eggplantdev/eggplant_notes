'use client'

import { useState } from 'react'

import { ButtonLink } from '@/components/ui/button-link'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  WELCOME_SEEN_COOKIE,
  WELCOME_SEEN_MAX_AGE,
} from '@/features/dashboard/welcome-dialog-cookie'

// Shown on the dashboard only when the account is empty AND the WELCOME_SEEN_COOKIE is unset — both
// gated server-side by the page, so the dialog never flashes. Dismissing (close or "Go to Settings")
// writes the cookie, so it shows once per browser and won't reappear on later visits.
export function WelcomeDialog() {
  const [open, setOpen] = useState(true)

  const markSeen = () => {
    document.cookie = `${WELCOME_SEEN_COOKIE}=1; path=/; max-age=${WELCOME_SEEN_MAX_AGE}; samesite=lax`
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) markSeen()
        setOpen(next)
      }}
    >
      <DialogContent className="gradient-border">
        <DialogHeader>
          <DialogTitle>Welcome 👋</DialogTitle>
          <DialogDescription>
            A place to organize what you&apos;re learning — built mainly for{' '}
            <strong>code notes</strong>, with <strong>syntax highlighting</strong> across many
            languages. Group your <strong>notes</strong> into <strong>subjects</strong>, then turn
            any note into <strong>memory cards</strong> and <strong>review</strong> a few each day —
            a <strong>daily goal</strong> keeps you on track. With AI you can generate not just
            cards but whole notes too. Head to Settings to load sample data, connect an OpenRouter
            account, or download a skill that lets an AI agent author notes and cards for you over
            CLI/HTTP. Still in active development, so expect a few rough edges.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Maybe later</Button>
          </DialogClose>
          <ButtonLink href="/settings" onClick={markSeen}>
            Go to Settings
          </ButtonLink>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
