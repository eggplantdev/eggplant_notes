import type { ReactNode } from 'react'

import { BrandIntroLockup } from '@/components/brand/brand-intro-lockup'
import { BrandIntroProvider } from '@/components/brand/brand-intro-provider'

// The brand intro plays here too (shared by all auth pages), morphing the splash lockup into the mark
// above the auth card. Replaces the old AuthBrandMark link — the lockup is the brand mark now.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <BrandIntroProvider>
      <main className="flex min-h-svh items-center justify-center p-4">
        <div className="grid w-full max-w-sm gap-8">
          <BrandIntroLockup
            logoClassName="size-14 md:size-16"
            wordmarkClassName="mt-2 font-mono text-2xl font-semibold tracking-tight md:text-3xl"
          />
          {children}
        </div>
      </main>
    </BrandIntroProvider>
  )
}
