import { PageShell } from '@/components/layout/page-shell'
import { DeleteAccountDialog } from '@/features/account/components/delete-account-dialog'
import { ConnectCard } from '@/features/openrouter/components/connect-card'
import { getOpenRouterStatus } from '@/features/openrouter/queries'
import { SampleDataSection } from '@/features/sample-data/components/sample-data-section'
import { DailyGoalForm } from '@/features/settings/components/daily-goal-form'
import { SettingsSection } from '@/features/settings/components/settings-section'
import { getDailyGoal } from '@/features/settings/queries'

export default async function SettingsPage() {
  const [dailyGoal, { connected: openRouterConnected, defaultModel: openRouterModel }] =
    await Promise.all([getDailyGoal(), getOpenRouterStatus()])

  return (
    <PageShell title="Settings" width="prose">
      <SettingsSection
        title="Preferences"
        description="How many distinct cards you aim to review each day."
      >
        <DailyGoalForm dailyGoal={dailyGoal} />
      </SettingsSection>

      <SettingsSection
        title="Sample data"
        description="Load a representative set of subjects, notes, and memory cards to explore the app — then clear it whenever you like."
      >
        <SampleDataSection />
      </SettingsSection>

      <SettingsSection
        title="AI (OpenRouter)"
        description="Bring your own OpenRouter key to generate notes and cards with AI. The key is encrypted and used only on the server."
        className="gradient-border"
      >
        <ConnectCard connected={openRouterConnected} defaultModel={openRouterModel} />
      </SettingsSection>

      <SettingsSection
        title="Danger zone"
        description="Permanently delete your account and all associated data."
        variant="danger"
      >
        <DeleteAccountDialog />
      </SettingsSection>
    </PageShell>
  )
}
