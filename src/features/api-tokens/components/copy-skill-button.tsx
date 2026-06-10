'use client'

import { useState } from 'react'

import { toastMessage } from '@/components/toasts'
import { Button } from '@/components/ui/button'

type CopySkillButtonPropsT = { skill: string }

// The skill markdown is injected with the origin server-side and handed in as a prop, so the copy is
// SYNCHRONOUS inside the click gesture — no `await fetch` before writeText (Safari drops the clipboard
// permission if the write isn't in the same task as the gesture). navigator.clipboard is still absent
// outside a secure context (plain-HTTP non-localhost); there we point the user at Download instead.
export function CopySkillButton({ skill }: CopySkillButtonPropsT) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!navigator.clipboard) {
      toastMessage('Copy unavailable here — use Download instead', 'warning')
      return
    }
    try {
      await navigator.clipboard.writeText(skill)
      setCopied(true)
      toastMessage('Skill copied', 'success')
    } catch {
      toastMessage('Could not copy — use Download instead', 'error')
    }
  }

  return (
    <Button type="button" onClick={copy} data-testid="skill-copy">
      {copied ? 'Copied ✓' : 'Copy skill'}
    </Button>
  )
}
