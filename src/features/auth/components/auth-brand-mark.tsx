'use client'

import type { MouseEvent } from 'react'

import { BrandMark, type BrandMarkPropsT } from '@/components/brand/brand-mark'
import { toastMessage } from '@/components/toasts'

// The brand lockup on the (logged-out) auth pages. A logged-out click is a no-op with toast feedback
// instead of the old `/` → /dashboard → /sign-in bounce; a logged-in visitor (edge case) navigates
// to /dashboard normally. `authed` comes from the server layout so the handler stays synchronous.
type AuthBrandMarkPropsT = Omit<BrandMarkPropsT, 'href' | 'onClick'> & {
  authed: boolean
}

export function AuthBrandMark({ authed, ...rest }: AuthBrandMarkPropsT) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (authed) return // let the Link navigate to /dashboard
    e.preventDefault()
    toastMessage('You have to be logged in to enter.', 'info')
  }

  // href is the no-JS / middle-click fallback — /sign-in (where they already are), never a bounce.
  return <BrandMark href={authed ? '/dashboard' : '/sign-in'} onClick={handleClick} {...rest} />
}
