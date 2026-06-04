import { PageShell } from '@/components/layout/page-shell'
import { DeleteAccountDialog } from '@/features/account/components/delete-account-dialog'
import { DailyGoalForm } from '@/features/settings/daily-goal-form'
import { getDailyGoal } from '@/features/settings/queries'

// Settings surface: review preferences (daily goal) + the account Danger zone.
// Gated by (protected)/layout.tsx. Other slices can extend it.
export default async function SettingsPage() {
  const dailyGoal = await getDailyGoal()

  return (
    <PageShell title="Settings" width="prose">
      <section className="grid w-full gap-3 rounded-lg border p-4">
        <div className="grid gap-1">
          <h2 className="text-lg font-medium">Preferences</h2>
          <p className="text-muted-foreground text-sm">
            How many distinct cards you aim to review each day.
          </p>
        </div>
        <DailyGoalForm dailyGoal={dailyGoal} />
      </section>

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
