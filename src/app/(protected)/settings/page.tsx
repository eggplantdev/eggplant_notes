import { PageShell } from '@/components/layout/page-shell'
import { DeleteAccountDialog } from '@/features/account/components/delete-account-dialog'

// Settings surface; for now its only content is the account Danger zone.
// Gated by (protected)/layout.tsx. Other slices (e.g. S-04) can extend it.
export default function SettingsPage() {
  return (
    <PageShell title="Settings" width="prose" hideTitleOnMobile>
      <section className="border-destructive/30 grid w-full gap-3 rounded-lg border p-4">
        <div className="grid gap-1">
          <h2 className="text-destructive text-lg font-medium">Danger zone</h2>
          <p className="text-muted-foreground text-sm">
            Permanently delete your account and all associated data.
          </p>
        </div>
        <DeleteAccountDialog />
      </section>
    </PageShell>
  )
}
