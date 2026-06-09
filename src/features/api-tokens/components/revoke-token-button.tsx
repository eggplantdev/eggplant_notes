'use client'

import { DeleteButton } from '@/components/ui/delete-button'
import { revokeApiToken } from '@/features/api-tokens/actions/revoke-api-token'

type RevokeTokenButtonPropsT = { tokenId: string; tokenName: string }

// Thin client wrapper so the server-rendered list can render a per-row confirm + revoke. Reuses
// DeleteButton (its own confirm dialog + action transition); revoke returns ActionResultT and
// revalidatePath drops the row, so no onSuccess callback is needed.
export function RevokeTokenButton({ tokenId, tokenName }: RevokeTokenButtonPropsT) {
  return (
    <DeleteButton
      title="Revoke token"
      description={`Revoke "${tokenName}"? Any agent or script using it will immediately stop working. This can't be undone.`}
      action={() => revokeApiToken(tokenId)}
      triggerLabel="Revoke"
      confirmLabel="Revoke"
      successMessage="Token revoked"
    />
  )
}
