import Link from 'next/link'

import { Button } from '@/components/ui/button'

export function LandingCta() {
  return (
    <section className="mx-auto flex w-full max-w-6xl justify-center px-5 sm:px-8">
      <Button asChild variant="ai" size="lg" className="h-14 px-8 text-lg">
        <Link href="/sign-up">Get started</Link>
      </Button>
    </section>
  )
}
