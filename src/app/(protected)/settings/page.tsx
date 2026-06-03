import { DeleteAccountDialog } from '@/features/account/components/delete-account-dialog'

// Settings surface; for now its only content is the account Danger zone.
// Gated by (protected)/layout.tsx. Other slices (e.g. S-04) can extend it.
export default function SettingsPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-start justify-center gap-6 p-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="border-destructive/30 grid w-full gap-3 rounded-lg border p-4">
        <div className="grid gap-1">
          <h2 className="text-destructive text-lg font-medium">Danger zone</h2>
          <p className="text-muted-foreground text-sm">
            Permanently delete your account and all associated data.
          </p>
        </div>
        <DeleteAccountDialog />
      </section>
    </main>
  )
}
