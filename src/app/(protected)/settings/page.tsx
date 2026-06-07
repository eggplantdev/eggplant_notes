import { PageShell } from '@/components/layout/page-shell'
import { MutedText } from '@/components/ui/muted-text'
import { DeleteAccountDialog } from '@/features/account/components/delete-account-dialog'
import { ConnectCard } from '@/features/openrouter/components/connect-card'
import { isOpenRouterConnected } from '@/features/openrouter/queries'
import { SampleDataSection } from '@/features/sample-data/components/sample-data-section'
import { DailyGoalForm } from '@/features/settings/components/daily-goal-form'
import { getDailyGoal } from '@/features/settings/queries'

export default async function SettingsPage() {
  const [dailyGoal, openRouterConnected] = await Promise.all([
    getDailyGoal(),
    isOpenRouterConnected(),
  ])

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

      <section className="grid w-full gap-3 rounded-lg border p-4">
        <div className="grid gap-1">
          <h2 className="text-lg font-medium">Sample data</h2>
          <MutedText>
            Load a representative set of subjects, notes, and memory cards to explore the app — then
            clear it whenever you like.
          </MutedText>
        </div>
        <SampleDataSection />
      </section>

      <section className="grid w-full gap-3 rounded-lg border p-4">
        <div className="grid gap-1">
          <h2 className="text-lg font-medium">AI (OpenRouter)</h2>
          <MutedText>
            Bring your own OpenRouter key to generate notes and cards with AI. The key is encrypted
            and used only on the server.
          </MutedText>
        </div>
        <ConnectCard connected={openRouterConnected} />
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
