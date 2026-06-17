'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'

type PropsT = {
  backHref?: string
  backLabel?: string
  // Navigate browser history (router.back) instead of backHref; falls back to backHref/'/' on a deep link with no history.
  backHistory?: boolean
}

export function PageBackButton({ backHref, backLabel, backHistory }: PropsT) {
  const router = useRouter()

  if (!backHref && !backHistory) return null

  return (
    <div>
      {backHistory ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (window.history.length > 1 ? router.back() : router.push(backHref ?? '/'))}
        >
          ← {backLabel}
        </Button>
      ) : (
        <Button asChild variant="ghost" size="sm">
          <Link href={backHref!}>← {backLabel}</Link>
        </Button>
      )}
    </div>
  )
}
