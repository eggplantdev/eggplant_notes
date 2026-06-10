import { RevokeTokenButton } from '@/features/api-tokens/components/revoke-token-button'
import type { ApiTokenListItemT } from '@/features/api-tokens/queries'
import { formatLocaleDate } from '@/lib/utils/date'

type ApiTokensListPropsT = { tokens: ApiTokenListItemT[] }

// Server component: dates format on the server (no client locale → no hydration mismatch); only the
// per-row revoke control is a client island. Active tokens only — revoked rows are filtered upstream.
export function ApiTokensList({ tokens }: ApiTokensListPropsT) {
  if (tokens.length === 0) {
    return <p className="text-muted-foreground text-sm">No tokens yet. Create one above.</p>
  }

  return (
    <ul className="divide-border divide-y" data-testid="api-tokens-list">
      {tokens.map((token) => (
        <li
          key={token.id}
          className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
          data-testid="api-token-row"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{token.name}</p>
            <p className="text-muted-foreground text-xs">
              Created {formatLocaleDate(token.created_at)} ·{' '}
              {token.last_used_at
                ? `last used ${formatLocaleDate(token.last_used_at)}`
                : 'never used'}
            </p>
          </div>
          <RevokeTokenButton tokenId={token.id} tokenName={token.name} />
        </li>
      ))}
    </ul>
  )
}
