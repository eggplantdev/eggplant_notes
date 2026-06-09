import { ApiTokensList } from '@/features/api-tokens/components/api-tokens-list'
import { MintTokenForm } from '@/features/api-tokens/components/mint-token-form'
import type { ApiTokenListItemT } from '@/features/api-tokens/queries'

type ApiTokensSectionPropsT = { tokens: ApiTokenListItemT[] }

// Composes the CLI-token lifecycle inside the Settings "CLI Tokens" SettingsSection: mint form
// (+ its show-once modal) above the active-token list. The Phase-2 download button mounts here too.
export function ApiTokensSection({ tokens }: ApiTokensSectionPropsT) {
  return (
    <div className="flex flex-col gap-6">
      <MintTokenForm />
      <ApiTokensList tokens={tokens} />
    </div>
  )
}
