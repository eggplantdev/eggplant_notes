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

// Shown on the dashboard only when the account is empty (server-gated by the page). Open-by-default,
// uncontrolled-from-the-server: no persistence — closing affects this render only, so it reappears on
// the next visit while the account is still empty, and stops once content exists (page no longer renders it).
export function WelcomeDialog() {
  const [open, setOpen] = useState(true)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gradient-border">
        <DialogHeader>
          <DialogTitle>Welcome 👋</DialogTitle>
          <DialogDescription>
            This app is a simple loop: write a <strong>note</strong>, turn it into{' '}
            <strong>memory cards</strong>, then <strong>review</strong> them a little each day. Head
            to Settings to get started — you can load sample data to explore, or connect an
            OpenRouter account to generate cards with AI. You can even download a skill that lets an
            AI agent connect over CLI/HTTP and author notes and cards for you.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Maybe later</Button>
          </DialogClose>
          <ButtonLink href="/settings">Go to Settings</ButtonLink>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
