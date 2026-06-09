import { headers } from 'next/headers'

import { buttonVariants } from '@/components/ui/button'
import { ApiTokensList } from '@/features/api-tokens/components/api-tokens-list'
import { CopySkillButton } from '@/features/api-tokens/components/copy-skill-button'
import { MintTokenForm } from '@/features/api-tokens/components/mint-token-form'
import type { ApiTokenListItemT } from '@/features/api-tokens/queries'
import { fillSkillTemplate } from '@/features/api-tokens/skill'
import { originFromHeaders } from '@/lib/request-origin'

type ApiTokensSectionPropsT = { tokens: ApiTokenListItemT[] }

// Composes the CLI-token lifecycle inside the Settings "CLI Tokens" SettingsSection: mint form
// (+ its show-once modal) above the active-token list, then the agent-skill copy/download.
export async function ApiTokensSection({ tokens }: ApiTokensSectionPropsT) {
  // Inject the origin here (server) so Copy can hand the client a ready string and write it to the
  // clipboard synchronously within the click gesture. Download re-injects via /api/skill — both go
  // through fillSkillTemplate + originFromHeaders, so they can't drift.
  const skill = fillSkillTemplate(originFromHeaders(await headers()))

  return (
    <div className="flex flex-col gap-6">
      <MintTokenForm />
      <ApiTokensList tokens={tokens} />

      <div className="border-border flex flex-col gap-2 border-t pt-6">
        <p className="text-muted-foreground text-sm">
          Copy the agent skill or download it, drop it into your coding agent, and paste a token
          above. The deployment URL is baked in for you.
        </p>
        <div className="flex flex-wrap gap-3">
          <CopySkillButton skill={skill} />
          {/* A plain anchor (not a Button island): the browser sends the session cookie, the route is
              session-gated, and Content-Disposition makes it a download. `download` is belt-and-suspenders. */}
          <a
            href="/api/skill"
            download
            className={buttonVariants({ variant: 'outline' })}
            data-testid="skill-download"
          >
            Download agent skill
          </a>
        </div>
      </div>
    </div>
  )
}
