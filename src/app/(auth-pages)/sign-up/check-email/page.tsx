import Link from 'next/link'

import { TitledCard } from '@/components/ui/titled-card'

// Shown after sign-up when email confirmation is required (prod): the user has no session yet and must
// click the link in their inbox. A persistent page — not a toast — because the instruction asks them to
// leave the app, so it has to survive a tab-switch and stay until they navigate back.
export default function CheckEmailPage() {
  return (
    <TitledCard
      variant="gradient"
      title="Check your email"
      description="Your account is almost ready."
    >
      <div className="grid gap-4 text-sm">
        <p className="text-muted-foreground">
          We sent a confirmation link to your email address. Open it to activate your account, then
          sign in.
        </p>
        <p className="text-muted-foreground">
          Didn’t get it? Check your spam folder, or{' '}
          <Link href="/sign-up" className="underline">
            try signing up again
          </Link>
          .
        </p>
        <Link href="/sign-in" className="underline">
          Back to sign in
        </Link>
      </div>
    </TitledCard>
  )
}
